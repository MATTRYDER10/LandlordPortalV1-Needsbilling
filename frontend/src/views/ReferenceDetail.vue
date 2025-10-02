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
              {{ reference.tenant_first_name }} {{ reference.tenant_last_name }}
            </h2>
            <p class="mt-2 text-gray-600">Reference Details</p>
          </div>
          <span
            class="px-3 py-1 text-sm font-semibold rounded-full"
            :class="{
              'bg-yellow-100 text-yellow-800': reference.status === 'pending',
              'bg-blue-100 text-blue-800': reference.status === 'in_progress',
              'bg-green-100 text-green-800': reference.status === 'completed',
              'bg-gray-100 text-gray-800': reference.status === 'cancelled'
            }"
          >
            {{ formatStatus(reference.status) }}
          </span>
        </div>

        <!-- Tenant Information -->
        <div class="bg-white rounded-lg shadow p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Tenant Information</h3>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-500">Email</label>
              <p class="mt-1 text-gray-900">{{ reference.tenant_email }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500">Phone</label>
              <p class="mt-1 text-gray-900">{{ reference.tenant_phone || 'Not provided' }}</p>
            </div>
          </div>
        </div>

        <!-- Property Information -->
        <div class="bg-white rounded-lg shadow p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Property Information</h3>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-500">Address</label>
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
              <p class="mt-1 text-gray-900">{{ reference.move_in_date ? formatDate(reference.move_in_date) : 'Not provided' }}</p>
            </div>
          </div>
        </div>

        <!-- Employment Information -->
        <div class="bg-white rounded-lg shadow p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Employment Information</h3>
          <div v-if="reference.employment_status" class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-500">Employment Status</label>
              <p class="mt-1 text-gray-900">{{ reference.employment_status }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500">Employer Name</label>
              <p class="mt-1 text-gray-900">{{ reference.employer_name || 'Not provided' }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500">Job Title</label>
              <p class="mt-1 text-gray-900">{{ reference.job_title || 'Not provided' }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500">Annual Income</label>
              <p class="mt-1 text-gray-900">{{ reference.annual_income ? `£${reference.annual_income}` : 'Not provided' }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500">Employer Email</label>
              <p class="mt-1 text-gray-900">{{ reference.employer_email || 'Not provided' }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500">Employer Phone</label>
              <p class="mt-1 text-gray-900">{{ reference.employer_phone || 'Not provided' }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500">Employment Start Date</label>
              <p class="mt-1 text-gray-900">{{ reference.employment_start_date ? formatDate(reference.employment_start_date) : 'Not provided' }}</p>
            </div>
          </div>
          <div v-else class="text-gray-500 text-center py-4">
            Tenant has not submitted employment information yet
          </div>

          <!-- Employer Reference Link (only show if not submitted) -->
          <div v-if="reference.employer_email && !employerReference" class="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
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

          <!-- Employer Reference Submitted (show completed reference) -->
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

        <!-- Previous Landlord Information -->
        <div class="bg-white rounded-lg shadow p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Previous Landlord Information</h3>
          <div v-if="reference.previous_landlord_name" class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-500">Landlord Name</label>
              <p class="mt-1 text-gray-900">{{ reference.previous_landlord_name }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500">Landlord Email</label>
              <p class="mt-1 text-gray-900">{{ reference.previous_landlord_email || 'Not provided' }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500">Landlord Phone</label>
              <p class="mt-1 text-gray-900">{{ reference.previous_landlord_phone || 'Not provided' }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500">Previous Street</label>
              <p class="mt-1 text-gray-900">{{ reference.previous_street || 'Not provided' }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500">Previous City</label>
              <p class="mt-1 text-gray-900">{{ reference.previous_city || 'Not provided' }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500">Previous Postcode</label>
              <p class="mt-1 text-gray-900">{{ reference.previous_postcode || 'Not provided' }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500">Tenancy Duration</label>
              <p class="mt-1 text-gray-900">{{ formatTenancyDuration(reference.tenancy_years, reference.tenancy_months) }}</p>
            </div>
          </div>
          <div v-else class="text-gray-500 text-center py-4">
            Tenant has not submitted previous landlord information yet
          </div>

          <!-- Landlord Reference Link (only show if not submitted) -->
          <div v-if="reference.previous_landlord_email && !landlordReference" class="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
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

          <!-- Landlord Reference Submitted (show completed reference) -->
          <div v-if="landlordReference" class="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
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
        </div>

        <!-- Supporting Documents -->
        <div v-if="reference.bank_statement_files?.length || reference.payslip_files?.length" class="bg-white rounded-lg shadow p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Supporting Documents</h3>

          <div v-if="reference.bank_statement_files?.length" class="mb-6">
            <label class="block text-sm font-medium text-gray-700 mb-3">Bank Statements</label>
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
            <label class="block text-sm font-medium text-gray-700 mb-3">Payslips</label>
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

        <!-- Timestamps -->
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

        <!-- Actions -->
        <div class="bg-white rounded-lg shadow p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Actions</h3>
          <div class="flex space-x-4">
            <button
              @click="copyTenantLink"
              class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md"
            >
              Copy Tenant Link
            </button>
          </div>
        </div>
      </div>
    </div>
  </Sidebar>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import { useAuthStore } from '../stores/auth'
import Sidebar from '../components/Sidebar.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const reference = ref<any>(null)
const landlordReference = ref<any>(null)
const employerReference = ref<any>(null)
const loading = ref(true)
const error = ref('')

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
    employerReference.value = data.employerReference
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

const getLandlordReferenceLink = () => {
  return `${window.location.origin}/landlord-reference/${reference.value?.id || ''}`
}

const getEmployerReferenceLink = () => {
  return `${window.location.origin}/employer-reference/${reference.value?.id || ''}`
}

const toast = useToast()

const copyLandlordLink = async () => {
  try {
    await navigator.clipboard.writeText(getLandlordReferenceLink())
    toast.success('Landlord reference link copied to clipboard!')
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

const copyTenantLink = () => {
  if (reference.value) {
    const link = `${window.location.origin}/submit-reference/${reference.value.reference_token}`
    navigator.clipboard.writeText(link)
    useToast().success('Tenant link copied to clipboard!')
  }
}

const downloadFile = async (filePath: string) => {
  try {
    const token = authStore.session?.access_token
    if (!token) {
      useToast().error('Authentication required')
      return
    }

    // Parse file path: referenceId/folder/filename
    const parts = filePath.split('/')
    const downloadUrl = `${API_URL}/api/references/download/${parts[0]}/${parts[1]}/${encodeURIComponent(parts[2])}`

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
    useToast().error('Failed to download file')
  }
}
</script>
