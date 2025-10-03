<template>
  <div class="min-h-screen bg-background">
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
        'bg-orange-50 border border-orange-200': reference.status === 'pending_verification',
        'bg-green-50 border border-green-200': reference.status === 'completed',
        'bg-blue-50 border border-blue-200': reference.status === 'in_progress'
      }">
        <div class="flex items-center justify-between">
          <div>
            <span class="text-sm font-medium" :class="{
              'text-orange-800': reference.status === 'pending_verification',
              'text-green-800': reference.status === 'completed',
              'text-blue-800': reference.status === 'in_progress'
            }">
              Status: {{ formatStatus(reference.status) }}
            </span>
          </div>
          <div class="text-sm text-gray-600">
            Company: <span class="font-semibold">{{ reference.companies?.name }}</span>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Left Column - Reference Details -->
        <div class="lg:col-span-2 space-y-6">
          <!-- Tenant Information -->
          <div class="bg-white shadow rounded-lg p-6">
            <h2 class="text-lg font-semibold text-gray-900 mb-4">Tenant Information</h2>
            <dl class="grid grid-cols-2 gap-4">
              <div>
                <dt class="text-sm font-medium text-gray-500">Name</dt>
                <dd class="mt-1 text-sm text-gray-900">{{ reference.tenant_first_name }} {{ reference.tenant_last_name }}</dd>
              </div>
              <div>
                <dt class="text-sm font-medium text-gray-500">Email</dt>
                <dd class="mt-1 text-sm text-gray-900">{{ reference.tenant_email }}</dd>
              </div>
              <div>
                <dt class="text-sm font-medium text-gray-500">Phone</dt>
                <dd class="mt-1 text-sm text-gray-900">{{ reference.tenant_phone || 'N/A' }}</dd>
              </div>
              <div>
                <dt class="text-sm font-medium text-gray-500">Employment Status</dt>
                <dd class="mt-1 text-sm text-gray-900">{{ reference.employment_status || 'N/A' }}</dd>
              </div>
              <div v-if="reference.employer_name">
                <dt class="text-sm font-medium text-gray-500">Employer Name</dt>
                <dd class="mt-1 text-sm text-gray-900">{{ reference.employer_name }}</dd>
              </div>
              <div v-if="reference.job_title">
                <dt class="text-sm font-medium text-gray-500">Job Title</dt>
                <dd class="mt-1 text-sm text-gray-900">{{ reference.job_title }}</dd>
              </div>
              <div v-if="reference.annual_income">
                <dt class="text-sm font-medium text-gray-500">Annual Income</dt>
                <dd class="mt-1 text-sm text-gray-900">£{{ reference.annual_income }}</dd>
              </div>
              <div v-if="reference.employment_start_date">
                <dt class="text-sm font-medium text-gray-500">Employment Start Date</dt>
                <dd class="mt-1 text-sm text-gray-900">{{ formatDate(reference.employment_start_date) }}</dd>
              </div>
              <div v-if="reference.employer_email">
                <dt class="text-sm font-medium text-gray-500">Employer Email</dt>
                <dd class="mt-1 text-sm text-gray-900">{{ reference.employer_email }}</dd>
              </div>
              <div v-if="reference.employer_phone">
                <dt class="text-sm font-medium text-gray-500">Employer Phone</dt>
                <dd class="mt-1 text-sm text-gray-900">{{ reference.employer_phone }}</dd>
              </div>
            </dl>
          </div>

          <!-- Previous Landlord Information (from tenant submission) -->
          <div v-if="reference.previous_landlord_name" class="bg-white shadow rounded-lg p-6">
            <h2 class="text-lg font-semibold text-gray-900 mb-4">Previous Landlord Information (Tenant Provided)</h2>
            <dl class="grid grid-cols-2 gap-4">
              <div>
                <dt class="text-sm font-medium text-gray-500">Landlord Name</dt>
                <dd class="mt-1 text-sm text-gray-900">{{ reference.previous_landlord_name }}</dd>
              </div>
              <div>
                <dt class="text-sm font-medium text-gray-500">Email</dt>
                <dd class="mt-1 text-sm text-gray-900">{{ reference.previous_landlord_email || 'N/A' }}</dd>
              </div>
              <div>
                <dt class="text-sm font-medium text-gray-500">Phone</dt>
                <dd class="mt-1 text-sm text-gray-900">{{ reference.previous_landlord_phone || 'N/A' }}</dd>
              </div>
              <div>
                <dt class="text-sm font-medium text-gray-500">Previous Address</dt>
                <dd class="mt-1 text-sm text-gray-900">{{ reference.previous_street || 'N/A' }}</dd>
              </div>
              <div>
                <dt class="text-sm font-medium text-gray-500">City</dt>
                <dd class="mt-1 text-sm text-gray-900">{{ reference.previous_city || 'N/A' }}</dd>
              </div>
              <div>
                <dt class="text-sm font-medium text-gray-500">Postcode</dt>
                <dd class="mt-1 text-sm text-gray-900">{{ reference.previous_postcode || 'N/A' }}</dd>
              </div>
              <div>
                <dt class="text-sm font-medium text-gray-500">Tenancy Duration</dt>
                <dd class="mt-1 text-sm text-gray-900">{{ formatTenancyDuration(reference.tenancy_years, reference.tenancy_months) }}</dd>
              </div>
            </dl>
          </div>

          <!-- Property Information -->
          <div class="bg-white shadow rounded-lg p-6">
            <h2 class="text-lg font-semibold text-gray-900 mb-4">Property Information</h2>
            <dl class="grid grid-cols-2 gap-4">
              <div class="col-span-2">
                <dt class="text-sm font-medium text-gray-500">Address</dt>
                <dd class="mt-1 text-sm text-gray-900">{{ reference.property_address }}</dd>
              </div>
              <div>
                <dt class="text-sm font-medium text-gray-500">City</dt>
                <dd class="mt-1 text-sm text-gray-900">{{ reference.property_city || 'N/A' }}</dd>
              </div>
              <div>
                <dt class="text-sm font-medium text-gray-500">Postcode</dt>
                <dd class="mt-1 text-sm text-gray-900">{{ reference.property_postcode || 'N/A' }}</dd>
              </div>
              <div>
                <dt class="text-sm font-medium text-gray-500">Monthly Rent</dt>
                <dd class="mt-1 text-sm text-gray-900">£{{ reference.monthly_rent || 'N/A' }}</dd>
              </div>
              <div>
                <dt class="text-sm font-medium text-gray-500">Move-in Date</dt>
                <dd class="mt-1 text-sm text-gray-900">{{ formatDate(reference.move_in_date) }}</dd>
              </div>
            </dl>
          </div>

          <!-- Landlord Reference -->
          <div v-if="landlordReference" class="bg-white shadow rounded-lg p-6">
            <h2 class="text-lg font-semibold text-gray-900 mb-4">✓ Landlord Reference Completed</h2>

            <!-- Contact Information -->
            <div class="mb-6">
              <h3 class="text-sm font-semibold text-gray-800 mb-3">Contact Information</h3>
              <dl class="grid grid-cols-2 gap-4">
                <div>
                  <dt class="text-xs font-medium text-gray-500">Full Name</dt>
                  <dd class="mt-1 text-sm text-gray-900">{{ landlordReference.landlord_name }}</dd>
                </div>
                <div>
                  <dt class="text-xs font-medium text-gray-500">Email</dt>
                  <dd class="mt-1 text-sm text-gray-900">{{ landlordReference.landlord_email }}</dd>
                </div>
                <div>
                  <dt class="text-xs font-medium text-gray-500">Phone</dt>
                  <dd class="mt-1 text-sm text-gray-900">{{ landlordReference.landlord_phone }}</dd>
                </div>
              </dl>
            </div>

            <!-- Property & Tenancy Details -->
            <div class="mb-6">
              <h3 class="text-sm font-semibold text-gray-800 mb-3">Property & Tenancy Details</h3>
              <dl class="grid grid-cols-2 gap-4">
                <div class="col-span-2">
                  <dt class="text-xs font-medium text-gray-500">Property Address</dt>
                  <dd class="mt-1 text-sm text-gray-900">{{ landlordReference.property_address }}</dd>
                </div>
                <div v-if="landlordReference.property_city">
                  <dt class="text-xs font-medium text-gray-500">City</dt>
                  <dd class="mt-1 text-sm text-gray-900">{{ landlordReference.property_city }}</dd>
                </div>
                <div v-if="landlordReference.property_postcode">
                  <dt class="text-xs font-medium text-gray-500">Postcode</dt>
                  <dd class="mt-1 text-sm text-gray-900">{{ landlordReference.property_postcode }}</dd>
                </div>
                <div>
                  <dt class="text-xs font-medium text-gray-500">Tenancy Start</dt>
                  <dd class="mt-1 text-sm text-gray-900">{{ formatDate(landlordReference.tenancy_start_date) }}</dd>
                </div>
                <div>
                  <dt class="text-xs font-medium text-gray-500">Tenancy End</dt>
                  <dd class="mt-1 text-sm text-gray-900">{{ formatDate(landlordReference.tenancy_end_date) }}</dd>
                </div>
                <div>
                  <dt class="text-xs font-medium text-gray-500">Monthly Rent</dt>
                  <dd class="mt-1 text-sm text-gray-900">£{{ landlordReference.monthly_rent }}</dd>
                </div>
              </dl>
            </div>

            <!-- Reference Assessment -->
            <div class="mb-6">
              <h3 class="text-sm font-semibold text-gray-800 mb-3">Reference Assessment</h3>
              <div class="space-y-4">
                <div>
                  <div class="flex items-center justify-between mb-1">
                    <span class="text-xs font-medium text-gray-500">Rent Paid On Time:</span>
                    <span class="text-sm font-semibold capitalize" :class="landlordReference.rent_paid_on_time === 'yes' ? 'text-green-600' : 'text-red-600'">
                      {{ landlordReference.rent_paid_on_time }}
                    </span>
                  </div>
                  <p v-if="landlordReference.rent_paid_on_time_details" class="text-sm text-gray-600 italic pl-3 border-l-2 border-gray-300">
                    {{ landlordReference.rent_paid_on_time_details }}
                  </p>
                </div>

                <div>
                  <div class="flex items-center justify-between mb-1">
                    <span class="text-xs font-medium text-gray-500">Property Condition:</span>
                    <span class="text-sm font-semibold capitalize" :class="{
                      'text-green-600': landlordReference.property_condition === 'excellent' || landlordReference.property_condition === 'good',
                      'text-yellow-600': landlordReference.property_condition === 'satisfactory',
                      'text-red-600': landlordReference.property_condition === 'poor'
                    }">
                      {{ landlordReference.property_condition }}
                    </span>
                  </div>
                  <p v-if="landlordReference.property_condition_details" class="text-sm text-gray-600 italic pl-3 border-l-2 border-gray-300">
                    {{ landlordReference.property_condition_details }}
                  </p>
                </div>

                <div>
                  <div class="flex items-center justify-between mb-1">
                    <span class="text-xs font-medium text-gray-500">Neighbour Complaints:</span>
                    <span class="text-sm font-semibold capitalize" :class="landlordReference.neighbour_complaints === 'no' ? 'text-green-600' : 'text-red-600'">
                      {{ landlordReference.neighbour_complaints }}
                    </span>
                  </div>
                  <p v-if="landlordReference.neighbour_complaints_details" class="text-sm text-gray-600 italic pl-3 border-l-2 border-gray-300">
                    {{ landlordReference.neighbour_complaints_details }}
                  </p>
                </div>

                <div>
                  <div class="flex items-center justify-between mb-1">
                    <span class="text-xs font-medium text-gray-500">Breach of Tenancy:</span>
                    <span class="text-sm font-semibold capitalize" :class="landlordReference.breach_of_tenancy === 'no' ? 'text-green-600' : 'text-red-600'">
                      {{ landlordReference.breach_of_tenancy }}
                    </span>
                  </div>
                  <p v-if="landlordReference.breach_of_tenancy_details" class="text-sm text-gray-600 italic pl-3 border-l-2 border-gray-300">
                    {{ landlordReference.breach_of_tenancy_details }}
                  </p>
                </div>

                <div>
                  <div class="flex items-center justify-between mb-1">
                    <span class="text-xs font-medium text-gray-500">Would Rent Again:</span>
                    <span class="text-sm font-semibold capitalize" :class="landlordReference.would_rent_again === 'yes' ? 'text-green-600' : 'text-red-600'">
                      {{ landlordReference.would_rent_again }}
                    </span>
                  </div>
                  <p v-if="landlordReference.would_rent_again_details" class="text-sm text-gray-600 italic pl-3 border-l-2 border-gray-300">
                    {{ landlordReference.would_rent_again_details }}
                  </p>
                </div>
              </div>
            </div>

            <!-- Additional Comments -->
            <div v-if="landlordReference.additional_comments" class="mb-6">
              <h3 class="text-sm font-semibold text-gray-800 mb-2">Additional Comments</h3>
              <p class="text-sm text-gray-900 bg-gray-50 p-3 rounded">{{ landlordReference.additional_comments }}</p>
            </div>

            <!-- Signature -->
            <div class="pt-4 border-t border-gray-200">
              <h3 class="text-sm font-semibold text-gray-800 mb-2">Signature</h3>
              <div v-if="landlordReference.signature_name" class="mb-2 text-sm text-gray-700 font-medium">
                {{ landlordReference.signature_name }}
              </div>
              <img :src="landlordReference.signature" alt="Signature" class="max-w-md h-auto border border-gray-200 rounded p-2 bg-white" />
              <p class="text-xs text-gray-500 mt-2">Date: {{ formatDate(landlordReference.date) }}</p>
              <p class="text-xs text-gray-500">Submitted: {{ formatDateTime(landlordReference.submitted_at) }}</p>
            </div>
          </div>

          <!-- Employer Reference -->
          <div v-if="employerReference" class="bg-white shadow rounded-lg p-6">
            <h2 class="text-lg font-semibold text-gray-900 mb-4">✓ Employer Reference Completed</h2>

            <!-- Company Info -->
            <div class="mb-6">
              <h3 class="text-sm font-semibold text-gray-800 mb-3">Company Information</h3>
              <dl class="grid grid-cols-2 gap-4">
                <div>
                  <dt class="text-xs font-medium text-gray-500">Company Name</dt>
                  <dd class="mt-1 text-sm text-gray-900">{{ employerReference.company_name }}</dd>
                </div>
                <div>
                  <dt class="text-xs font-medium text-gray-500">Contact Person</dt>
                  <dd class="mt-1 text-sm text-gray-900">{{ employerReference.employer_name }}</dd>
                </div>
                <div>
                  <dt class="text-xs font-medium text-gray-500">Position</dt>
                  <dd class="mt-1 text-sm text-gray-900">{{ employerReference.employer_position }}</dd>
                </div>
                <div>
                  <dt class="text-xs font-medium text-gray-500">Email</dt>
                  <dd class="mt-1 text-sm text-gray-900">{{ employerReference.employer_email }}</dd>
                </div>
              </dl>
            </div>

            <!-- Employment Details -->
            <div class="mb-6">
              <h3 class="text-sm font-semibold text-gray-800 mb-3">Employment Details</h3>
              <dl class="grid grid-cols-2 gap-4">
                <div>
                  <dt class="text-xs font-medium text-gray-500">Employee Position</dt>
                  <dd class="mt-1 text-sm text-gray-900">{{ employerReference.employee_position }}</dd>
                </div>
                <div>
                  <dt class="text-xs font-medium text-gray-500">Employment Type</dt>
                  <dd class="mt-1 text-sm text-gray-900 capitalize">{{ employerReference.employment_type }}</dd>
                </div>
                <div>
                  <dt class="text-xs font-medium text-gray-500">Start Date</dt>
                  <dd class="mt-1 text-sm text-gray-900">{{ formatDate(employerReference.employment_start_date) }}</dd>
                </div>
                <div v-if="employerReference.employment_end_date">
                  <dt class="text-xs font-medium text-gray-500">End Date</dt>
                  <dd class="mt-1 text-sm text-gray-900">{{ formatDate(employerReference.employment_end_date) }}</dd>
                </div>
                <div>
                  <dt class="text-xs font-medium text-gray-500">Currently Employed</dt>
                  <dd class="mt-1 text-sm text-gray-900">{{ employerReference.is_current_employee ? 'Yes' : 'No' }}</dd>
                </div>
                <div>
                  <dt class="text-xs font-medium text-gray-500">Employment Status</dt>
                  <dd class="mt-1 text-sm text-gray-900 capitalize">{{ employerReference.employment_status }}</dd>
                </div>
              </dl>
            </div>

            <!-- Compensation -->
            <div class="mb-6">
              <h3 class="text-sm font-semibold text-gray-800 mb-3">Compensation</h3>
              <dl class="grid grid-cols-2 gap-4">
                <div>
                  <dt class="text-xs font-medium text-gray-500">Annual Salary</dt>
                  <dd class="mt-1 text-sm text-gray-900">£{{ employerReference.annual_salary }}</dd>
                </div>
                <div>
                  <dt class="text-xs font-medium text-gray-500">Salary Frequency</dt>
                  <dd class="mt-1 text-sm text-gray-900 capitalize">{{ employerReference.salary_frequency }}</dd>
                </div>
                <div>
                  <dt class="text-xs font-medium text-gray-500">On Probation</dt>
                  <dd class="mt-1 text-sm text-gray-900 capitalize">{{ employerReference.is_probation }}</dd>
                </div>
              </dl>
            </div>

            <!-- Performance Assessment -->
            <div class="mb-6">
              <h3 class="text-sm font-semibold text-gray-800 mb-3">Performance Assessment</h3>
              <dl class="grid grid-cols-2 gap-4">
                <div>
                  <dt class="text-xs font-medium text-gray-500">Performance Rating</dt>
                  <dd class="mt-1 text-sm font-semibold capitalize" :class="{
                    'text-green-600': employerReference.performance_rating === 'excellent',
                    'text-blue-600': employerReference.performance_rating === 'good',
                    'text-yellow-600': employerReference.performance_rating === 'satisfactory',
                    'text-red-600': employerReference.performance_rating === 'poor'
                  }">
                    {{ employerReference.performance_rating }}
                  </dd>
                </div>
                <div>
                  <dt class="text-xs font-medium text-gray-500">Attendance Record</dt>
                  <dd class="mt-1 text-sm text-gray-900 capitalize">{{ employerReference.absence_record }}</dd>
                </div>
                <div>
                  <dt class="text-xs font-medium text-gray-500">Disciplinary Issues</dt>
                  <dd class="mt-1 text-sm text-gray-900 capitalize" :class="employerReference.disciplinary_issues === 'no' ? 'text-green-600' : 'text-red-600'">
                    {{ employerReference.disciplinary_issues }}
                  </dd>
                </div>
                <div>
                  <dt class="text-xs font-medium text-gray-500">Would Re-employ</dt>
                  <dd class="mt-1 text-sm font-semibold capitalize" :class="employerReference.would_reemploy === 'yes' ? 'text-green-600' : 'text-red-600'">
                    {{ employerReference.would_reemploy }}
                  </dd>
                </div>
                <div v-if="employerReference.performance_details" class="col-span-2">
                  <dt class="text-xs font-medium text-gray-500">Performance Details</dt>
                  <dd class="mt-1 text-sm text-gray-900 bg-gray-50 p-3 rounded">{{ employerReference.performance_details }}</dd>
                </div>
                <div v-if="employerReference.additional_comments" class="col-span-2">
                  <dt class="text-xs font-medium text-gray-500">Additional Comments</dt>
                  <dd class="mt-1 text-sm text-gray-900 bg-gray-50 p-3 rounded">{{ employerReference.additional_comments }}</dd>
                </div>
              </dl>
            </div>

            <!-- Signature -->
            <div class="pt-4 border-t border-gray-200">
              <h3 class="text-sm font-semibold text-gray-800 mb-2">Signature</h3>
              <div v-if="employerReference.signature_name" class="mb-2 text-sm text-gray-700 font-medium">
                {{ employerReference.signature_name }}
              </div>
              <img :src="employerReference.signature" alt="Signature" class="max-w-md h-auto border border-gray-200 rounded p-2 bg-white" />
              <p class="text-xs text-gray-500 mt-2">Date: {{ formatDate(employerReference.date) }}</p>
              <p class="text-xs text-gray-500">Submitted: {{ formatDateTime(employerReference.submitted_at) }}</p>
            </div>
          </div>

          <!-- Supporting Documents -->
          <div v-if="reference.bank_statement_files?.length || reference.payslip_files?.length" class="bg-white shadow rounded-lg p-6">
            <h2 class="text-lg font-semibold text-gray-900 mb-4">Supporting Documents</h2>

            <div v-if="reference.bank_statement_files?.length" class="mb-6">
              <h3 class="text-sm font-medium text-gray-700 mb-3">Bank Statements</h3>
              <div class="space-y-2">
                <div v-for="(file, index) in reference.bank_statement_files" :key="index"
                     class="flex items-center justify-between bg-gray-50 px-4 py-3 rounded-lg">
                  <div class="flex items-center">
                    <svg class="w-5 h-5 text-gray-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <span class="text-sm text-gray-900">Bank Statement {{ index + 1 }}</span>
                  </div>
                  <button
                    @click="downloadFile(file)"
                    class="px-3 py-1 text-sm font-medium text-primary hover:text-primary/80 rounded-md"
                  >
                    Download
                  </button>
                </div>
              </div>
            </div>

            <div v-if="reference.payslip_files?.length">
              <h3 class="text-sm font-medium text-gray-700 mb-3">Payslips</h3>
              <div class="space-y-2">
                <div v-for="(file, index) in reference.payslip_files" :key="index"
                     class="flex items-center justify-between bg-gray-50 px-4 py-3 rounded-lg">
                  <div class="flex items-center">
                    <svg class="w-5 h-5 text-gray-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <span class="text-sm text-gray-900">Payslip {{ index + 1 }}</span>
                  </div>
                  <button
                    @click="downloadFile(file)"
                    class="px-3 py-1 text-sm font-medium text-primary hover:text-primary/80 rounded-md"
                  >
                    Download
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Notes -->
          <div v-if="reference.notes || reference.internal_notes" class="bg-white shadow rounded-lg p-6">
            <h2 class="text-lg font-semibold text-gray-900 mb-4">Notes</h2>
            <div v-if="reference.notes" class="mb-4">
              <h3 class="text-sm font-medium text-gray-500 mb-2">Reference Notes</h3>
              <p class="text-sm text-gray-900 bg-gray-50 p-3 rounded">{{ reference.notes }}</p>
            </div>
            <div v-if="reference.internal_notes">
              <h3 class="text-sm font-medium text-gray-500 mb-2">Internal Notes</h3>
              <p class="text-sm text-gray-900 bg-gray-50 p-3 rounded">{{ reference.internal_notes }}</p>
            </div>
          </div>
        </div>

        <!-- Right Column - Verification Panel -->
        <div class="lg:col-span-1">
          <div class="bg-white shadow rounded-lg p-6 sticky top-6">
            <h2 class="text-lg font-semibold text-gray-900 mb-4">Verification</h2>

            <div v-if="reference.status === 'pending_verification'">
              <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-2">Verification Notes</label>
                <textarea
                  v-model="verificationNotes"
                  rows="4"
                  class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                  placeholder="Add any notes about this verification..."
                ></textarea>
              </div>

              <div v-if="error" class="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded text-sm">
                {{ error }}
              </div>

              <div v-if="success" class="mb-4 bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded text-sm">
                {{ success }}
              </div>

              <div class="space-y-3">
                <button
                  @click="handleVerify"
                  :disabled="submitting"
                  class="w-full px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md disabled:opacity-50"
                >
                  {{ submitting ? 'Verifying...' : 'Approve & Complete' }}
                </button>
                <button
                  @click="handleReject"
                  :disabled="submitting || !verificationNotes"
                  class="w-full px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md disabled:opacity-50"
                >
                  {{ submitting ? 'Rejecting...' : 'Reject & Return' }}
                </button>
                <p class="text-xs text-gray-500">
                  * Rejection requires notes
                </p>
              </div>
            </div>

            <div v-else-if="reference.status === 'completed'" class="text-center py-4">
              <div class="text-green-600 mb-2">
                <svg class="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p class="text-sm font-medium text-gray-900">Verification Complete</p>
              <p v-if="reference.verified_at" class="text-xs text-gray-500 mt-2">
                {{ formatDate(reference.verified_at) }}
              </p>
              <div v-if="reference.verification_notes" class="mt-4 text-left">
                <p class="text-sm font-medium text-gray-700">Notes:</p>
                <p class="mt-1 text-sm text-gray-600">{{ reference.verification_notes }}</p>
              </div>
            </div>

            <div class="mt-6 pt-6 border-t border-gray-200">
              <h3 class="text-sm font-medium text-gray-700 mb-2">Timeline</h3>
              <div class="space-y-2 text-xs text-gray-600">
                <div>
                  <span class="font-medium">Created:</span> {{ formatDate(reference.created_at) }}
                </div>
                <div v-if="reference.submitted_at">
                  <span class="font-medium">Submitted:</span> {{ formatDate(reference.submitted_at) }}
                </div>
                <div v-if="reference.verified_at">
                  <span class="font-medium">Verified:</span> {{ formatDate(reference.verified_at) }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const reference = ref<any>(null)
const landlordReference = ref<any>(null)
const employerReference = ref<any>(null)
const loading = ref(true)
const submitting = ref(false)
const error = ref('')
const success = ref('')
const verificationNotes = ref('')

onMounted(() => {
  fetchReference()
})

const fetchReference = async () => {
  try {
    loading.value = true
    const token = authStore.session?.access_token
    if (!token) return

    const response = await fetch(`${API_URL}/api/staff/references/${route.params.id}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    if (response.ok) {
      const data = await response.json()
      reference.value = data.reference
      landlordReference.value = data.landlordReference
      employerReference.value = data.employerReference
    }
  } catch (err) {
    console.error('Failed to fetch reference:', err)
  } finally {
    loading.value = false
  }
}

const handleVerify = async () => {
  error.value = ''
  success.value = ''
  submitting.value = true

  try {
    const token = authStore.session?.access_token
    if (!token) return

    const response = await fetch(`${API_URL}/api/staff/references/${route.params.id}/verify`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ notes: verificationNotes.value })
    })

    if (response.ok) {
      success.value = 'Reference verified successfully!'
      setTimeout(() => {
        router.push('/staff/dashboard')
      }, 1500)
    } else {
      const data = await response.json()
      error.value = data.error || 'Failed to verify reference'
    }
  } catch (err: any) {
    error.value = err.message || 'Failed to verify reference'
  } finally {
    submitting.value = false
  }
}

const handleReject = async () => {
  if (!verificationNotes.value) {
    error.value = 'Please add notes explaining why this reference is being rejected'
    return
  }

  error.value = ''
  success.value = ''
  submitting.value = true

  try {
    const token = authStore.session?.access_token
    if (!token) return

    const response = await fetch(`${API_URL}/api/staff/references/${route.params.id}/reject`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ notes: verificationNotes.value })
    })

    if (response.ok) {
      success.value = 'Reference rejected and sent back for corrections'
      setTimeout(() => {
        router.push('/staff/dashboard')
      }, 1500)
    } else {
      const data = await response.json()
      error.value = data.error || 'Failed to reject reference'
    }
  } catch (err: any) {
    error.value = err.message || 'Failed to reject reference'
  } finally {
    submitting.value = false
  }
}

const handleSignOut = async () => {
  await authStore.signOut()
  router.push('/staff/login')
}

const formatStatus = (status: string) => {
  return status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
}

const formatDate = (date: string) => {
  if (!date) return 'N/A'
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}

const formatDateTime = (date: string) => {
  if (!date) return 'N/A'
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const formatTenancyDuration = (years: number | null, months: number | null) => {
  if (!years && !months) return 'N/A'
  const parts = []
  if (years && years > 0) {
    parts.push(`${years} year${years !== 1 ? 's' : ''}`)
  }
  if (months && months > 0) {
    parts.push(`${months} month${months !== 1 ? 's' : ''}`)
  }
  return parts.join(', ')
}

const downloadFile = async (filePath: string) => {
  try {
    const token = authStore.session?.access_token
    if (!token) {
      error.value = 'Authentication required'
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
  } catch (err) {
    error.value = 'Failed to download file'
  }
}
</script>
