<template>
  <Sidebar>
    <div class="p-8">
      <div v-if="loading" class="flex justify-center items-center h-64">
        <div class="text-gray-600">Loading landlord...</div>
      </div>

      <div v-else-if="error" class="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
        {{ error }}
      </div>

      <div v-else-if="landlord" class="space-y-6">
        <!-- Header -->
        <div class="flex justify-between items-start">
          <div>
            <button @click="$router.push('/landlords')"
              class="text-gray-600 hover:text-gray-900 mb-4 flex items-center">
              <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Landlords
            </button>
            <h2 class="text-3xl font-bold text-gray-900">
              {{ landlord.first_name }} {{ landlord.middle_name ? landlord.middle_name + ' ' : '' }}{{
              landlord.last_name }}
            </h2>
            <p class="mt-2 text-gray-600">Complete Landlord Details</p>
          </div>
          <div class="flex items-center gap-3">
            <button @click="showEditModal = true"
              class="flex items-center px-4 py-2 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary/90 transition-colors">
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit
            </button>
            <span class="px-3 py-1 text-sm font-semibold rounded-full" :class="{
              'bg-green-100 text-green-800': landlord.aml_status === 'satisfactory',
              'bg-red-100 text-red-800': landlord.aml_status === 'unsatisfactory',
              'bg-blue-100 text-blue-800': landlord.aml_status === 'requested',
              'bg-gray-100 text-gray-800': landlord.aml_status === 'not_requested'
            }">
              {{ formatAMLStatus(landlord.aml_status) }}
            </span>
          </div>
        </div>

        <!-- Tabs -->
        <div class="border-b border-gray-200">
          <nav class="-mb-px flex space-x-8">
            <button @click="activeTab = 'overview'" :class="[
              'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm',
              activeTab === 'overview'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            ]">
              Overview
            </button>
            <button @click="activeTab = 'aml'" :class="[
              'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm',
              activeTab === 'aml'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            ]">
              AML checks
            </button>
          </nav>
        </div>

        <!-- Overview Tab -->
        <div v-if="activeTab === 'overview'" class="space-y-6">
          <!-- AML Card -->
          <div class="bg-white rounded-lg shadow p-6">
            <div class="flex justify-between items-center mb-4">
              <h3 class="text-lg font-semibold text-gray-900">AML</h3>
            </div>
            <div>
              <span class="px-3 py-1 text-sm font-semibold rounded-full inline-flex items-center gap-2" :class="{
                'bg-green-100 text-green-800': landlord.aml_status === 'satisfactory',
                'bg-red-100 text-red-800': landlord.aml_status === 'unsatisfactory',
                'bg-blue-100 text-blue-800': landlord.aml_status === 'requested',
                'bg-gray-100 text-gray-800': landlord.aml_status === 'not_requested'
              }">
                <svg v-if="landlord.aml_status === 'satisfactory'" class="w-4 h-4" fill="currentColor"
                  viewBox="0 0 20 20">
                  <path fill-rule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clip-rule="evenodd" />
                </svg>
                {{ formatAMLStatus(landlord.aml_status) }}
              </span>
              <p v-if="landlord.aml_completed_at" class="mt-2 text-sm text-gray-500">
                Completed: {{ formatDate(landlord.aml_completed_at) }}
              </p>
            </div>
          </div>

          <!-- Properties Card -->
          <div class="bg-white rounded-lg shadow p-6">
            <div class="flex justify-between items-center mb-4">
              <h3 class="text-lg font-semibold text-gray-900">Properties</h3>
              <button @click="showAddPropertyModal = true"
                class="px-3 py-1 text-sm font-medium text-primary hover:text-primary/80">
                + Add
              </button>
            </div>
            <div v-if="landlord.properties && landlord.properties.length > 0" class="space-y-3">
              <div v-for="property in landlord.properties" :key="property.id" class="p-3 bg-gray-50 rounded-lg">
                <div class="text-sm font-medium text-gray-900">
                  {{ property.address.line1 }}{{ property.address.line2 ? ', ' + property.address.line2 : '' }}
                </div>
                <div class="text-sm text-gray-600">
                  {{ property.address.city }}, {{ property.address.postcode }}
                </div>
              </div>
            </div>
            <div v-else class="text-sm text-gray-500">
              No Properties listed
            </div>
          </div>

          <!-- Details Card -->
          <div class="bg-white rounded-lg shadow p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">Details</h3>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label class="block text-sm font-medium text-gray-500">Name</label>
                <p class="mt-1 text-sm text-gray-900">
                  {{ landlord.title ? landlord.title + ' ' : '' }}{{ landlord.first_name }} {{ landlord.middle_name ?
                  landlord.middle_name + ' ' : '' }}{{ landlord.last_name }}
                </p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-500">Email</label>
                <p class="mt-1 text-sm text-gray-900">{{ landlord.email }}</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-500">Phone</label>
                <p class="mt-1 text-sm text-gray-900">{{ landlord.phone || 'Not provided' }}</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-500">Date of Birth</label>
                <p class="mt-1 text-sm text-gray-900">{{ landlord.date_of_birth ? formatDate(landlord.date_of_birth) :
                  'Not provided' }}</p>
              </div>
            </div>
          </div>

          <!-- Residential Address Card -->
          <div class="bg-white rounded-lg shadow p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">Residential Address</h3>
            <div class="space-y-2">
              <p class="text-sm text-gray-900">
                {{ landlord.residential_address.line1 }}{{ landlord.residential_address.line2 ? ', ' +
                landlord.residential_address.line2 : '' }}
              </p>
              <p class="text-sm text-gray-900">
                {{ landlord.residential_address.city }}, {{ landlord.residential_address.postcode }}
              </p>
              <p class="text-sm text-gray-900">{{ landlord.residential_address.country || 'GB' }}</p>
            </div>
          </div>

          <!-- Bank Details Card -->
          <div class="bg-white rounded-lg shadow p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">Landlord bank details</h3>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label class="block text-sm font-medium text-gray-500">Account number (optional)</label>
                <p class="mt-1 text-sm text-gray-900">{{ landlord.bank_details.account_number || 'Not provided' }}</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-500">Sort code (optional)</label>
                <p class="mt-1 text-sm text-gray-900">{{ landlord.bank_details.sort_code || 'Not provided' }}</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-500">Is this a joint account? (optional)</label>
                <p class="mt-1 text-sm text-gray-900">{{ landlord.bank_details.is_joint_account ? 'Yes' : 'No' }}</p>
              </div>
            </div>
          </div>

          <!-- Regulatory Information Card -->
          <div class="bg-white rounded-lg shadow p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">Regulatory information</h3>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label class="block text-sm font-medium text-gray-500">
                  Landlord registration number (optional)
                  <span class="text-blue-500 hover:text-blue-700 ml-1"
                    title="In Wales we require a Rent Smart Wales License Number, In England we require the Landlord’s registration number (From Feb 27th 2026)">What
                    is this?</span>
                </label>
                <p class="mt-1 text-sm text-gray-900">{{ landlord.regulatory.landlord_registration_number ||
                  'Notprovided' }}</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-500">
                  Landlord license number (optional)
                  <span class="text-blue-500 hover:text-blue-700 ml-1"
                    title="In Wales we require a Rent Smart Wales License Number, In England we require the Landlord’s registration number (From Feb 27th 2026)">What
                    is this?</span>
                </label>
                <p class="mt-1 text-sm text-gray-900">{{ landlord.regulatory.landlord_license_number || 'Not provided'
                  }}</p>
              </div>
              <div class="sm:col-span-2">
                <label class="flex items-center">
                  <input type="checkbox" :checked="landlord.regulatory.agent_sign_on_behalf" disabled
                    class="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded" />
                  <span class="ml-2 text-sm text-gray-700">Agent to sign on behalf of the landlord</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <!-- AML Checks Tab -->
        <div v-if="activeTab === 'aml'" class="space-y-6">
          <div class="bg-white rounded-lg shadow p-6">
            <div class="flex justify-between items-center mb-4">
              <h3 class="text-lg font-semibold text-gray-900">AML Check Status</h3>
              <button @click="initiateAMLCheck" :disabled="initiatingAML"
                class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md disabled:opacity-50 disabled:cursor-not-allowed">
                {{ initiatingAML ? 'Initiating...' : landlord.aml_check ? 'Re-initiate AML Check' : 'Initiate AML Check'
                }}
              </button>
            </div>

            <div v-if="landlord.aml_check">
              <!-- Top Summary (Status + Identity Match + Risk Level + Score) -->
              <section class="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <header class="mb-6 border-b border-gray-100 pb-6">
                  <h2 class="text-lg font-semibold text-gray-900 mb-1">Verification Result</h2>
                </header>

                <!-- <div class="flex flex-wrap justify-between gap-6">
                 
                  <div class="flex flex-col gap-4 min-w-[240px]">
                    
                    <div class="flex items-center gap-3">
                      <span class="text-sm font-medium text-gray-500 uppercase tracking-wide">Status</span>
                      <span :class="badgeClass(landlord.aml_check.verification_status)">
                        {{ formatAMLStatus(landlord.aml_check.verification_status) }}
                      </span>
                    </div>

                   
                    <div class="flex items-center gap-3">
                      <span class="text-sm font-medium text-gray-500 uppercase tracking-wide">Identity Match</span>
                      <span :class="badgeClass(identityMatchLabel)">
                        {{ identityMatchLabel }}
                      </span>
                    </div>

                  </div>
                </div> -->

                <!-- Verification Flags -->
                <div class="mt-8">
                  <h3 class="text-base font-semibold text-gray-800">Verification Flags</h3>

                  <div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <!-- Electoral Roll -->
                    <div :class="[
                      'flex items-center gap-3 rounded-xl border px-4 py-3',
                      electoralRollMatch ? 'border-emerald-100 bg-emerald-50/60' : 'border-rose-100 bg-rose-50/60'
                    ]">
                      <span :class="[
                        'flex h-8 w-8 items-center justify-center rounded-full bg-white shadow',
                        electoralRollMatch ? 'text-emerald-500' : 'text-rose-500'
                      ]">
                        <svg v-if="electoralRollMatch" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fill-rule="evenodd"
                            d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 10-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z"
                            clip-rule="evenodd" />
                        </svg>
                        <svg v-else class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fill-rule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                            clip-rule="evenodd" />
                        </svg>
                      </span>
                      <span class="text-sm font-semibold text-gray-800">Electoral Roll</span>
                    </div>

                    <!-- No CCJs -->
                    <div :class="[
                      'flex items-center gap-3 rounded-xl border px-4 py-3',
                      !ccjMatch ? 'border-emerald-100 bg-emerald-50/60' : 'border-rose-100 bg-rose-50/60'
                    ]">
                      <span :class="[
                        'flex h-8 w-8 items-center justify-center rounded-full bg-white shadow',
                        !ccjMatch ? 'text-emerald-500' : 'text-rose-500'
                      ]">
                        <svg v-if="!ccjMatch" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fill-rule="evenodd"
                            d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 10-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z"
                            clip-rule="evenodd" />
                        </svg>
                        <svg v-else class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fill-rule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                            clip-rule="evenodd" />
                        </svg>
                      </span>
                      <span class="text-sm font-semibold text-gray-800">No CCJs</span>
                    </div>

                    <!-- No Insolvency -->
                    <div :class="[
                      'flex items-center gap-3 rounded-xl border px-4 py-3',
                      !insolvencyMatch ? 'border-emerald-100 bg-emerald-50/60' : 'border-rose-100 bg-rose-50/60'
                    ]">
                      <span :class="[
                        'flex h-8 w-8 items-center justify-center rounded-full bg-white shadow',
                        !insolvencyMatch ? 'text-emerald-500' : 'text-rose-500'
                      ]">
                        <svg v-if="!insolvencyMatch" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fill-rule="evenodd"
                            d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 10-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z"
                            clip-rule="evenodd" />
                        </svg>
                        <svg v-else class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fill-rule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                            clip-rule="evenodd" />
                        </svg>
                      </span>
                      <span class="text-sm font-semibold text-gray-800">No Insolvency</span>
                    </div>

                    <!-- Not Deceased -->
                    <div :class="[
                      'flex items-center gap-3 rounded-xl border px-4 py-3',
                      !deceasedMatch ? 'border-emerald-100 bg-emerald-50/60' : 'border-rose-100 bg-rose-50/60'
                    ]">
                      <span :class="[
                        'flex h-8 w-8 items-center justify-center rounded-full bg-white shadow',
                        !deceasedMatch ? 'text-emerald-500' : 'text-rose-500'
                      ]">
                        <svg v-if="!deceasedMatch" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fill-rule="evenodd"
                            d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 10-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z"
                            clip-rule="evenodd" />
                        </svg>
                        <svg v-else class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fill-rule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                            clip-rule="evenodd" />
                        </svg>
                      </span>
                      <span class="text-sm font-semibold text-gray-800">Not Deceased</span>
                    </div>
                  </div>
                </div>

                <!-- Compliance Screening -->
                <div class="mt-10">
                  <h3 class="text-base font-semibold text-gray-800">Compliance Screening</h3>
                  <div class="mt-4 divide-y divide-gray-100">
                    <!-- PEP Check -->
                    <div class="flex items-center justify-between py-4">
                      <div>
                        <p class="text-sm font-semibold text-gray-800">Politically Exposed Person (PEP)</p>
                      </div>
                      <div class="flex items-center gap-2">
                        <span :class="statusClass(landlord.aml_check.pep_check_result === false ? 'clear' : 'failed')">
                          {{ landlord.aml_check.pep_check_result === false ? 'Clear' : 'Failed' }}
                        </span>
                        <span
                          :class="statusIconWrapper(landlord.aml_check.pep_check_result === false ? 'clear' : 'failed')">
                          <svg v-if="landlord.aml_check.pep_check_result === false" class="h-4 w-4 text-emerald-600"
                            viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd"
                              d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 10-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z"
                              clip-rule="evenodd" />
                          </svg>
                          <svg v-else class="h-4 w-4 text-rose-500" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                              clip-rule="evenodd" />
                          </svg>
                        </span>
                      </div>
                    </div>

                    <!-- Sanctions Check -->
                    <div class="flex items-center justify-between py-4">
                      <div>
                        <p class="text-sm font-semibold text-gray-800">Sanctions Screening</p>
                      </div>
                      <div class="flex items-center gap-2">
                        <span
                          :class="statusClass(landlord.aml_check.sanctions_check_result === false ? 'clear' : 'failed')">
                          {{ landlord.aml_check.sanctions_check_result === false ? 'Clear' : 'Failed' }}
                        </span>
                        <span :class="statusIconWrapper(
                          landlord.aml_check.sanctions_check_result === false ? 'clear' : 'failed'
                        )
                          ">
                          <svg v-if="landlord.aml_check.sanctions_check_result === false"
                            class="h-4 w-4 text-emerald-600" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd"
                              d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 10-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z"
                              clip-rule="evenodd" />
                          </svg>
                          <svg v-else class="h-4 w-4 text-rose-500" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                              clip-rule="evenodd" />
                          </svg>
                        </span>
                      </div>
                    </div>

                    <!-- Adverse Media Check -->
                    <div class="flex items-center justify-between py-4">
                      <div>
                        <p class="text-sm font-semibold text-gray-800">Adverse Media</p>
                      </div>
                      <div class="flex items-center gap-2">
                        <span
                          :class="statusClass(landlord.aml_check.adverse_media_result === false ? 'clear' : 'failed')">
                          {{ landlord.aml_check.adverse_media_result === false ? 'Clear' : 'Failed' }}
                        </span>
                        <span :class="statusIconWrapper(
                          landlord.aml_check.adverse_media_result === false ? 'clear' : 'failed'
                        )
                          ">
                          <svg v-if="landlord.aml_check.adverse_media_result === false" class="h-4 w-4 text-emerald-600"
                            viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd"
                              d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 10-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z"
                              clip-rule="evenodd" />
                          </svg>
                          <svg v-else class="h-4 w-4 text-rose-500" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                              clip-rule="evenodd" />
                          </svg>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div v-if="landlord.aml_check.verified_at" class="mt-6 border-t border-gray-100 pt-4">
                  <label class="block text-sm font-medium text-gray-500">Verified At</label>
                  <p class="mt-1 text-sm text-gray-900">
                    {{ formatDateTime(landlord.aml_check.verified_at) }}
                  </p>
                </div>
              </section>
            </div>
            <div v-else class="text-sm text-gray-500">
              No AML check has been initiated yet.
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit Modal -->
    <AddEditLandlordModal v-if="showEditModal" :show="showEditModal" :landlord-id="landlord?.id"
      @close="showEditModal = false" @saved="handleLandlordSaved" />
  </Sidebar>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useToast } from 'vue-toastification'
import Sidebar from '../components/Sidebar.vue'
import AddEditLandlordModal from '../components/AddEditLandlordModal.vue'
import { useAuthStore } from '../stores/auth'
import { formatDate as formatUkDate, formatDateTime as formatUkDateTime } from '../utils/date'

const route = useRoute()
const toast = useToast()
const authStore = useAuthStore()

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const loading = ref(false)
const error = ref('')
const landlord = ref<any>(null)
const activeTab = ref('overview')
const showEditModal = ref(false)
const showAddPropertyModal = ref(false)
const initiatingAML = ref(false)

const electoralRollMatch = computed(() => {
  // Treat satisfactory status as a positive electoral roll match
  return landlord.value?.aml_check?.verification_status === 'satisfactory'
}).value

const ccjMatch = computed(() => {
  // true means CCJ found (bad)
  return landlord.value?.aml_check?.fraud_indicators?.includes('ccj') ?? false
}).value

const insolvencyMatch = computed(() => {
  // true means insolvency found (bad)
  return landlord.value?.aml_check?.fraud_indicators?.includes('insolvency') ?? false
}).value

const deceasedMatch = computed(() => {
  // true means deceased (bad)
  return landlord.value?.aml_check?.fraud_indicators?.includes('deceased') ?? false
}).value

type Tone = 'success' | 'warning' | 'danger' | 'info'

const toneClasses: Record<Tone, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
  danger: 'border-rose-200 bg-rose-50 text-rose-700',
  info: 'border-slate-200 bg-slate-50 text-slate-700'
}

const subtleToneClasses: Record<Tone, string> = {
  success: 'text-emerald-600',
  warning: 'text-amber-600',
  danger: 'text-rose-600',
  info: 'text-slate-600'
}

const detectTone = (value?: string): Tone => {
  const normalized = (value ?? '').toLowerCase()
  if (['pass', 'passed', 'match', 'low', 'clear', 'success', 'no', 'found'].some((word) => normalized.includes(word))) {
    return 'success'
  }
  if (['fail', 'failed', 'high', 'risk', 'alert', 'adverse'].some((word) => normalized.includes(word))) {
    return 'danger'
  }
  if (['pending', 'medium', 'review', 'assessed', 'partial'].some((word) => normalized.includes(word))) {
    return 'warning'
  }
  return 'info'
}

const statusClass = (value?: string) => `text-sm font-semibold ${subtleToneClasses[detectTone(value)]}`

const statusIconWrapper = (value?: string) =>
  `flex h-8 w-8 items-center justify-center rounded-full border ${toneClasses[detectTone(value)]}`

const fetchLandlord = async () => {
  loading.value = true
  error.value = ''

  try {
    const landlordId = route.params.id as string
    const response = await fetch(`${API_URL}/api/landlords/${landlordId}`, {
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error('Failed to fetch landlord')
    }

    const data = await response.json()
    landlord.value = data.landlord

    // Check if edit mode
    if (route.query.edit === 'true') {
      showEditModal.value = true
    }
  } catch (err: any) {
    error.value = err.message || 'Failed to load landlord'
    toast.error('Failed to load landlord')
  } finally {
    loading.value = false
  }
}

const initiateAMLCheck = async () => {
  if (!landlord.value) return

  initiatingAML.value = true

  try {
    const response = await fetch(`${API_URL}/api/landlords/${landlord.value.id}/initiate-aml-check`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ chargeType: 'credits' })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to initiate AML check')
    }

    toast.success('AML check completed successfully.')
    const aml_check = await response.json()
    if(aml_check.aml_check) {
      landlord.value.aml_check = aml_check.aml_check
      landlord.value.aml_status = aml_check.aml_status
    }else{
    fetchLandlord()
    }
    initiatingAML.value = false
  } catch (err: any) {
    toast.error(err.message || 'Failed to initiate AML check')
  } finally {
    initiatingAML.value = false
  }
}

const handleLandlordSaved = () => {
  showEditModal.value = false
  fetchLandlord()
}

const formatAMLStatus = (status: string) => {
  const statusMap: Record<string, string> = {
    'not_requested': 'Not Requested',
    'requested': 'Requested',
    'satisfactory': 'AML satisfactory',
    'unsatisfactory': 'AML unsatisfactory'
  }
  return statusMap[status] || status
}

const formatDate = (dateString?: string | null, fallback = 'n/a') =>
  formatUkDate(
    dateString,
    {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    },
    fallback
  )

const formatDateTime = (dateString?: string | null, fallback = 'n/a') =>
  formatUkDateTime(
    dateString,
    {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    },
    fallback
  )

onMounted(() => {
  fetchLandlord()
})
</script>

