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
              ← Back
            </button>
            <h1 class="text-2xl font-bold text-gray-900">Reference Verification</h1>
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

    <!-- Loading State -->
    <div v-if="loading" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="text-center py-12">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p class="mt-2 text-gray-600">Loading reference...</p>
      </div>
    </div>

    <!-- Main Content -->
    <div v-else-if="reference" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Status Banner -->
      <div class="mb-6 p-4 rounded-lg" :class="{
        'bg-yellow-100 border border-yellow-200': reference.status === 'pending',
        'bg-blue-100 border border-blue-200': reference.status === 'in_progress',
        'bg-orange-100 border border-orange-200': reference.status === 'pending_verification',
        'bg-green-100 border border-green-200': reference.status === 'completed',
        'bg-red-100 border border-red-200': reference.status === 'rejected'
      }">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-4">
            <span class="text-sm font-medium" :class="{
              'text-yellow-800': reference.status === 'pending',
              'text-blue-800': reference.status === 'in_progress',
              'text-orange-800': reference.status === 'pending_verification',
              'text-green-800': reference.status === 'completed',
              'text-red-800': reference.status === 'rejected'
            }">
              Status: {{ formatStatus(reference.status) }}
            </span>
            <span class="text-2xl font-bold text-gray-900">
              {{ reference.first_name || reference.tenant_first_name }} {{ reference.middle_name ? reference.middle_name + ' ' : '' }}{{ reference.last_name || reference.tenant_last_name }}
            </span>
          </div>
          <div class="text-sm text-gray-600">
            Company: <span class="font-semibold">{{ reference.companies?.name || 'N/A' }}</span>
          </div>
        </div>
      </div>

      <div class="space-y-6">
        <!-- Property Information (from initial reference creation) -->
        <div class="bg-white rounded-lg shadow p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Property Information</h3>
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
              <p v-if="reference.parent_reference_id" class="mt-1 text-gray-900">
                <span class="font-semibold text-primary">£{{ reference.rent_share }}</span>
                <span class="text-sm text-gray-600"> (Tenant's share of £{{ reference.monthly_rent }} total)</span>
              </p>
              <p v-else class="mt-1 text-gray-900">{{ reference.monthly_rent ? `£${reference.monthly_rent}` : 'Not provided' }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500">Move-in Date</label>
              <p class="mt-1 text-gray-900">{{ reference.move_in_date ? formatDate(reference.move_in_date) : 'Not provided' }}</p>
            </div>
          </div>
        </div>

        <!-- Personal Details -->
        <div class="bg-white rounded-lg shadow p-6">
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
        <div class="bg-white rounded-lg shadow p-6">
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
                <button
                  @click="downloadFile(reference.id_document_path)"
                  class="px-3 py-1 text-sm font-medium text-primary hover:text-primary/80 rounded-md border border-primary"
                >
                  Download
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
                <button
                  @click="downloadFile(reference.selfie_path)"
                  class="px-3 py-1 text-sm font-medium text-primary hover:text-primary/80 rounded-md border border-primary"
                >
                  Download
                </button>
              </div>
            </div>
            <div v-if="!reference.id_document_path && !reference.selfie_path" class="text-gray-500 text-center py-4">
              No identification documents uploaded yet
            </div>
          </div>
        </div>

        <!-- Current Address -->
        <div class="bg-white rounded-lg shadow p-6">
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
              <p class="mt-1 text-gray-900">{{ reference.current_country || 'Not provided yet' }}</p>
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
                <button
                  @click="downloadFile(reference.proof_of_address_path)"
                  class="px-3 py-1 text-sm font-medium text-primary hover:text-primary/80 rounded-md border border-primary"
                >
                  Download
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
                <label class="block text-sm font-medium text-gray-500">Contract Type</label>
                <p class="mt-1 text-gray-900 capitalize">{{ reference.employment_contract_type?.replace('_', ' ') || 'Not provided' }}</p>
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
                <p class="mt-1 text-gray-900">{{ reference.employment_company_country || 'Not provided' }}</p>
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
                    <button
                      @click="downloadFile(file)"
                      class="px-3 py-1 text-sm font-medium text-primary hover:text-primary/80 rounded-md border border-primary"
                    >
                      Download
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

              <!-- Employer Reference Link (only show if not submitted) -->
              <div v-if="reference.employer_ref_email && !employerReference" class="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 class="text-sm font-semibold text-blue-900 mb-2">Employer Reference Form</h4>
                <p class="text-sm text-blue-800 mb-2">
                  Share this link with the employer to complete their reference:
                </p>
                <div class="flex items-center gap-2">
                  <input
                    type="text"
                    readonly
                    :value="getEmployerReferenceLink()"
                    class="flex-1 px-3 py-2 text-sm bg-white border border-blue-300 rounded-md font-mono text-xs"
                  />
                  <button
                    type="button"
                    @click="copyEmployerLink"
                    class="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 whitespace-nowrap"
                  >
                    Copy Link
                  </button>
                </div>
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
                      </div>
                    </div>

                    <!-- Reference Assessment -->
                    <div>
                      <h5 class="text-sm font-semibold text-green-800 mb-2">Performance Assessment</h5>
                      <div class="grid grid-cols-2 gap-3 text-sm">
                        <div><span class="text-green-700 font-medium">Employment Verified:</span> <span class="text-green-900">{{ employerReference.employment_status }}</span></div>
                        <div><span class="text-green-700 font-medium">Performance Rating:</span> <span class="text-green-900">{{ employerReference.performance_rating }}</span></div>
                        <div><span class="text-green-700 font-medium">Attendance:</span> <span class="text-green-900">{{ employerReference.absence_record }}</span></div>
                        <div><span class="text-green-700 font-medium">Disciplinary Issues:</span> <span class="text-green-900">{{ employerReference.disciplinary_issues }}</span></div>
                        <div class="col-span-2"><span class="text-green-700 font-medium">Would Re-employ:</span> <span class="text-green-900 font-semibold">{{ employerReference.would_reemploy }}</span></div>
                      </div>

                      <div v-if="employerReference.performance_details" class="mt-3 p-3 bg-white rounded border border-green-200">
                        <span class="text-green-700 font-medium text-sm">Performance Notes:</span>
                        <p class="text-green-900 text-sm mt-1">{{ employerReference.performance_details }}</p>
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
              <div v-if="reference.accountant_email && (!accountantReference || !accountantReference.submitted_at)" class="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p class="text-sm text-yellow-800">
                  <strong>Status:</strong> Pending accountant response
                </p>
                <p class="text-xs text-yellow-700 mt-1">
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

                  <div class="space-y-6">
                    <!-- Business Information -->
                    <div>
                      <h5 class="text-sm font-semibold text-green-800 mb-2">Business Information</h5>
                      <div class="grid grid-cols-2 gap-3 text-sm">
                        <div><span class="text-green-700 font-medium">Business Name:</span> <span class="text-green-900">{{ accountantReference.business_name }}</span></div>
                        <div><span class="text-green-700 font-medium">Trading Status:</span> <span class="text-green-900 capitalize">{{ accountantReference.business_trading_status }}</span></div>
                        <div><span class="text-green-700 font-medium">Start Date:</span> <span class="text-green-900">{{ formatDate(accountantReference.business_start_date) }}</span></div>
                        <div><span class="text-green-700 font-medium">Nature:</span> <span class="text-green-900">{{ accountantReference.nature_of_business }}</span></div>
                      </div>
                    </div>

                    <!-- Financial Information -->
                    <div>
                      <h5 class="text-sm font-semibold text-green-800 mb-2">Financial Information</h5>
                      <div class="grid grid-cols-2 gap-3 text-sm">
                        <div><span class="text-green-700 font-medium">Annual Turnover:</span> <span class="text-green-900">£{{ accountantReference.annual_turnover?.toLocaleString() }}</span></div>
                        <div><span class="text-green-700 font-medium">Annual Net Profit:</span> <span class="text-green-900">£{{ accountantReference.annual_profit?.toLocaleString() }}</span></div>
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

                    <!-- Income Verification -->
                    <div>
                      <h5 class="text-sm font-semibold text-green-800 mb-2">Income Verification</h5>
                      <div class="grid grid-cols-2 gap-3 text-sm">
                        <div><span class="text-green-700 font-medium">Income Confirmed:</span> <span class="text-green-900 font-semibold">{{ accountantReference.accountant_confirms_income ? 'Yes' : 'No' }}</span></div>
                        <div><span class="text-green-700 font-medium">Est. Monthly Income:</span> <span class="text-green-900">£{{ accountantReference.estimated_monthly_income?.toLocaleString() }}</span></div>
                      </div>
                    </div>

                    <!-- Recommendation -->
                    <div>
                      <h5 class="text-sm font-semibold text-green-800 mb-2">Professional Recommendation</h5>
                      <div class="mb-2">
                        <span class="text-green-700 font-medium text-sm">Would Recommend:</span>
                        <span class="ml-2 text-green-900 font-semibold">{{ accountantReference.would_recommend ? 'Yes' : 'No' }}</span>
                      </div>
                      <div v-if="accountantReference.recommendation_comments" class="mt-2 p-3 bg-white rounded border border-green-200">
                        <p class="text-green-900 text-sm">{{ accountantReference.recommendation_comments }}</p>
                      </div>
                      <div v-if="accountantReference.additional_comments" class="mt-2 p-3 bg-white rounded border border-green-200">
                        <span class="text-green-700 font-medium text-sm">Additional Comments:</span>
                        <p class="text-green-900 text-sm mt-1">{{ accountantReference.additional_comments }}</p>
                      </div>
                    </div>

                    <!-- Signature -->
                    <div class="pt-3 border-t border-green-300">
                      <div class="space-y-3">
                        <div>
                          <span class="text-green-700 font-medium text-sm">Signature:</span>
                          <div class="mt-2 p-3 bg-white rounded border border-green-200">
                            <div v-if="accountantReference.signature_name" class="mb-2 text-sm text-gray-700 font-medium">
                              {{ accountantReference.signature_name }}
                            </div>
                            <img :src="accountantReference.signature" alt="Signature" class="max-w-md h-auto" />
                          </div>
                        </div>
                        <div>
                          <span class="text-green-700 font-medium text-sm">Date:</span>
                          <span class="ml-2 text-green-900">{{ formatDate(accountantReference.date) }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
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
        <div class="bg-white rounded-lg shadow p-6">
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
        <div class="bg-white rounded-lg shadow p-6">
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

          <!-- Landlord Reference Link (only show if not submitted) -->
          <div v-if="reference.previous_landlord_email && reference.reference_type === 'landlord' && !landlordReference" class="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
            <h4 class="text-sm font-semibold text-purple-900 mb-2">Landlord Reference Form</h4>
            <p class="text-sm text-purple-800 mb-2">
              Share this link with the previous landlord to complete their reference:
            </p>
            <div class="flex items-center gap-2">
              <input
                type="text"
                readonly
                :value="getLandlordReferenceLink()"
                class="flex-1 px-3 py-2 text-sm bg-white border border-purple-300 rounded-md font-mono text-xs"
              />
              <button
                type="button"
                @click="copyLandlordLink"
                class="px-4 py-2 text-sm font-semibold text-white bg-purple-600 rounded-md hover:bg-purple-700 whitespace-nowrap"
              >
                Copy Link
              </button>
            </div>
          </div>

          <!-- Agent Reference Link (only show if not submitted) -->
          <div v-if="reference.previous_landlord_email && reference.reference_type === 'agent' && !agentReference" class="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
            <h4 class="text-sm font-semibold text-purple-900 mb-2">Letting Agent Reference Form</h4>
            <p class="text-sm text-purple-800 mb-2">
              Share this link with the letting agent to complete their reference:
            </p>
            <div class="flex items-center gap-2">
              <input
                type="text"
                readonly
                :value="getAgentReferenceLink()"
                class="flex-1 px-3 py-2 text-sm bg-white border border-purple-300 rounded-md font-mono text-xs"
              />
              <button
                type="button"
                @click="copyAgentLink"
                class="px-4 py-2 text-sm font-semibold text-white bg-purple-600 rounded-md hover:bg-purple-700 whitespace-nowrap"
              >
                Copy Link
              </button>
            </div>
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
                  <div>
                    <span class="text-green-700 font-medium">Property Address:</span>
                    <span class="ml-2 text-green-900">{{ landlordReference.property_address }}</span>
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
                  <div>
                    <div class="mb-1">
                      <span class="text-green-700 font-medium">Rent Paid On Time:</span>
                      <span class="ml-2 text-green-900 capitalize">{{ landlordReference.rent_paid_on_time }}</span>
                    </div>
                    <div v-if="landlordReference.rent_paid_on_time_details" class="ml-4 pl-3 border-l-2 border-green-300 text-green-800 italic">
                      {{ landlordReference.rent_paid_on_time_details }}
                    </div>
                  </div>

                  <div>
                    <div class="mb-1">
                      <span class="text-green-700 font-medium">Property Condition:</span>
                      <span class="ml-2 text-green-900 capitalize">{{ landlordReference.property_condition }}</span>
                    </div>
                    <div v-if="landlordReference.property_condition_details" class="ml-4 pl-3 border-l-2 border-green-300 text-green-800 italic">
                      {{ landlordReference.property_condition_details }}
                    </div>
                  </div>

                  <div>
                    <div class="mb-1">
                      <span class="text-green-700 font-medium">Neighbour Complaints:</span>
                      <span class="ml-2 text-green-900 capitalize">{{ landlordReference.neighbour_complaints }}</span>
                    </div>
                    <div v-if="landlordReference.neighbour_complaints_details" class="ml-4 pl-3 border-l-2 border-green-300 text-green-800 italic">
                      {{ landlordReference.neighbour_complaints_details }}
                    </div>
                  </div>

                  <div>
                    <div class="mb-1">
                      <span class="text-green-700 font-medium">Breach of Tenancy:</span>
                      <span class="ml-2 text-green-900 capitalize">{{ landlordReference.breach_of_tenancy }}</span>
                    </div>
                    <div v-if="landlordReference.breach_of_tenancy_details" class="ml-4 pl-3 border-l-2 border-green-300 text-green-800 italic">
                      {{ landlordReference.breach_of_tenancy_details }}
                    </div>
                  </div>

                  <div>
                    <div class="mb-1">
                      <span class="text-green-700 font-medium">Would Rent Again:</span>
                      <span class="ml-2 text-green-900 capitalize">{{ landlordReference.would_rent_again }}</span>
                    </div>
                    <div v-if="landlordReference.would_rent_again_details" class="ml-4 pl-3 border-l-2 border-green-300 text-green-800 italic">
                      {{ landlordReference.would_rent_again_details }}
                    </div>
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
                  <div>
                    <span class="text-green-700 font-medium">Property Address:</span>
                    <span class="ml-2 text-green-900">{{ agentReference.property_address }}</span>
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
            <div v-if="accountantReference?.submitted_at">
              <label class="block text-sm font-medium text-gray-500">Accountant Reference Submitted</label>
              <p class="mt-1 text-gray-900">{{ formatDateTime(accountantReference.submitted_at) }}</p>
            </div>
            <div v-if="reference.completed_at">
              <label class="block text-sm font-medium text-gray-500">Completed</label>
              <p class="mt-1 text-gray-900">{{ formatDateTime(reference.completed_at) }}</p>
            </div>
          </div>
        </div>

        <!-- Verification Actions (only show if status is pending_verification) -->
        <div v-if="reference.status === 'pending_verification'" class="bg-white rounded-lg shadow p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Verification</h3>
          <div class="flex space-x-4">
            <button
              @click="showVerifyModal = true"
              class="px-6 py-3 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md flex items-center"
            >
              <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Verify & Complete
            </button>
            <button
              @click="showRejectModal = true"
              class="px-6 py-3 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md flex items-center"
            >
              <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Reject for Corrections
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Verify Modal -->
    <div v-if="showVerifyModal" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div class="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" @click="showVerifyModal = false"></div>
        <span class="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
        <div class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div class="sm:flex sm:items-start">
              <div class="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-green-100 sm:mx-0 sm:h-10 sm:w-10">
                <svg class="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left flex-1">
                <h3 class="text-lg leading-6 font-medium text-gray-900">Verify Reference</h3>
                <div class="mt-4">
                  <label class="block text-sm font-medium text-gray-700 mb-2">Verification Notes (Optional)</label>
                  <textarea
                    v-model="verificationNotes"
                    rows="4"
                    placeholder="Add any notes about this verification..."
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                  ></textarea>
                </div>
              </div>
            </div>
          </div>
          <div class="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              @click="verifyReference"
              :disabled="verifying"
              class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
            >
              {{ verifying ? 'Verifying...' : 'Verify & Complete' }}
            </button>
            <button
              @click="showVerifyModal = false"
              :disabled="verifying"
              class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:w-auto sm:text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Reject Modal -->
    <div v-if="showRejectModal" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div class="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" @click="showRejectModal = false"></div>
        <span class="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
        <div class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div class="sm:flex sm:items-start">
              <div class="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                <svg class="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left flex-1">
                <h3 class="text-lg leading-6 font-medium text-gray-900">Reject Reference</h3>
                <div class="mt-4">
                  <label class="block text-sm font-medium text-gray-700 mb-2">Rejection Notes (Required) *</label>
                  <textarea
                    v-model="rejectionNotes"
                    rows="4"
                    placeholder="Explain what needs to be corrected..."
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
                    required
                  ></textarea>
                  <p class="mt-2 text-sm text-gray-500">These notes will be sent to the agent so they know what needs to be corrected.</p>
                </div>
              </div>
            </div>
          </div>
          <div class="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              @click="rejectReference"
              :disabled="rejecting || !rejectionNotes.trim()"
              class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
            >
              {{ rejecting ? 'Rejecting...' : 'Reject & Send Back' }}
            </button>
            <button
              @click="showRejectModal = false"
              :disabled="rejecting"
              class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:w-auto sm:text-sm"
            >
              Cancel
            </button>
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
              @click="downloadFile(viewingDocumentPath)"
              class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary text-base font-medium text-white hover:bg-primary/90 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm"
            >
              Download
            </button>
            <button
              @click="closeDocumentViewer"
              class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:w-auto sm:text-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import { useAuthStore } from '../stores/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const toast = useToast()

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const reference = ref<any>(null)
const landlordReference = ref<any>(null)
const agentReference = ref<any>(null)
const employerReference = ref<any>(null)
const accountantReference = ref<any>(null)
const loading = ref(true)

// Document viewer modal state
const viewingDocument = ref(false)
const viewingDocumentUrl = ref('')
const viewingDocumentName = ref('')
const viewingDocumentPath = ref('')
const viewingDocumentType = ref('') // 'image' or 'pdf'

// Verification/Rejection modal state
const showVerifyModal = ref(false)
const showRejectModal = ref(false)
const verificationNotes = ref('')
const rejectionNotes = ref('')
const verifying = ref(false)
const rejecting = ref(false)

onMounted(() => {
  fetchReference()
})

const fetchReference = async () => {
  try {
    const token = authStore.session?.access_token
    if (!token) {
      toast.error('Authentication required')
      loading.value = false
      router.push('/staff/login')
      return
    }

    const response = await fetch(`${API_URL}/api/staff/references/${route.params.id}`, {
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
  } catch (error: any) {
    toast.error(error.message || 'Failed to load reference')
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

const getLandlordReferenceLink = () => {
  return `${window.location.origin}/landlord-reference/${reference.value?.id || ''}`
}

const getAgentReferenceLink = () => {
  return `${window.location.origin}/agent-reference/${reference.value?.id || ''}`
}

const getEmployerReferenceLink = () => {
  return `${window.location.origin}/employer-reference/${reference.value?.id || ''}`
}

const copyLandlordLink = async () => {
  try {
    await navigator.clipboard.writeText(getLandlordReferenceLink())
    toast.success('Landlord reference link copied to clipboard!')
  } catch (error) {
    toast.error('Failed to copy link to clipboard')
  }
}

const copyAgentLink = async () => {
  try {
    await navigator.clipboard.writeText(getAgentReferenceLink())
    toast.success('Agent reference link copied to clipboard!')
  } catch (error) {
    toast.error('Failed to copy link to clipboard')
  }
}

const copyEmployerLink = async () => {
  try {
    await navigator.clipboard.writeText(getEmployerReferenceLink())
    toast.success('Employer reference link copied to clipboard!')
  } catch (error) {
    toast.error('Failed to copy link to clipboard')
  }
}

const downloadFile = async (filePath: string) => {
  try {
    const token = authStore.session?.access_token
    if (!token) {
      toast.error('Authentication required')
      return
    }

    // Parse file path: referenceId/folder/filename
    const parts = filePath.split('/')
    const downloadUrl = `${API_URL}/api/staff/download/${parts[0]}/${parts[1]}/${encodeURIComponent(parts[2] || '')}`

    const response = await fetch(downloadUrl, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (!response.ok) {
      throw new Error('Failed to download file')
    }

    const blob = await response.blob()
    const blobUrl = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = filePath.split('/').pop() || 'document'
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(blobUrl)
    document.body.removeChild(a)
  } catch (error) {
    toast.error('Failed to download file')
  }
}

const viewFile = async (filePath: string) => {
  try {
    const token = authStore.session?.access_token
    if (!token) {
      toast.error('Authentication required')
      return
    }

    // Parse file path: referenceId/folder/filename
    const parts = filePath.split('/')
    const downloadUrl = `${API_URL}/api/staff/download/${parts[0]}/${parts[1]}/${encodeURIComponent(parts[2] || '')}`

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
    } else if (imageExtensions.includes(extension || '')) {
      docType = 'image'
    }

    // Set modal state
    viewingDocumentUrl.value = blobUrl
    viewingDocumentName.value = filename
    viewingDocumentPath.value = filePath
    viewingDocumentType.value = docType
    viewingDocument.value = true
  } catch (error) {
    toast.error('Failed to view file')
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

const verifyReference = async () => {
  try {
    verifying.value = true
    const token = authStore.session?.access_token
    if (!token) {
      toast.error('Authentication required')
      return
    }

    const response = await fetch(`${API_URL}/api/staff/references/${route.params.id}/verify`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        notes: verificationNotes.value || null
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to verify reference')
    }

    toast.success('Reference verified and completed successfully!')
    showVerifyModal.value = false
    verificationNotes.value = ''

    // Refresh the reference data
    await fetchReference()
  } catch (error: any) {
    toast.error(error.message || 'Failed to verify reference')
  } finally {
    verifying.value = false
  }
}

const rejectReference = async () => {
  if (!rejectionNotes.value.trim()) {
    toast.error('Rejection notes are required')
    return
  }

  try {
    rejecting.value = true
    const token = authStore.session?.access_token
    if (!token) {
      toast.error('Authentication required')
      return
    }

    const response = await fetch(`${API_URL}/api/staff/references/${route.params.id}/reject`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        notes: rejectionNotes.value
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to reject reference')
    }

    toast.success('Reference rejected and sent back for corrections')
    showRejectModal.value = false
    rejectionNotes.value = ''

    // Refresh the reference data
    await fetchReference()
  } catch (error: any) {
    toast.error(error.message || 'Failed to reject reference')
  } finally {
    rejecting.value = false
  }
}

const handleSignOut = async () => {
  await authStore.signOut()
  router.push('/staff/login')
}
</script>
