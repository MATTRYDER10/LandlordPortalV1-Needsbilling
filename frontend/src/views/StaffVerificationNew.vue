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
              <span class="ml-3 text-sm font-semibold px-3 py-1 bg-primary/10 text-primary rounded-full">Staff
                Portal</span>
            </h1>
          </div>
          <div class="flex items-center gap-4">
            <router-link to="/staff/work-queue"
              class="flex items-center px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md">
              <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Back to Work Queue
            </router-link>
            <button @click="handleSignOut"
              class="flex items-center px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md">
              <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
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
          <h2 class="text-xl font-bold text-gray-900">6-Step Verification</h2>
          <span class="text-sm text-gray-500">Step {{ currentStep }} of 6 • {{ Math.round((currentStep / 6) * 100) }}%
            Complete</span>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-2">
          <div class="bg-primary h-2 rounded-full transition-all duration-300"
            :style="{ width: `${(currentStep / 6) * 100}%` }"></div>
        </div>
        <div class="grid grid-cols-6 gap-4 mt-3">
          <div v-for="(step, index) in stepLabels" :key="index" :class="[
            'text-center py-2 px-3 rounded-md text-sm font-medium transition-all',
            currentStep > index + 1 ? 'bg-green-100 text-green-800' :
              currentStep === index + 1 ? 'bg-primary/10 text-primary' :
                'bg-gray-100 text-gray-400'
          ]">
            <div class="flex items-center justify-center gap-2">
              <svg v-if="currentStep > index + 1" class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clip-rule="evenodd" />
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

        <!-- Profile-style header: image on left, name/email aligned horizontally -->
        <div class="flex items-center gap-4 mb-6">
          <!-- Tenant Image -->
          <div class="relative">
            <img v-if="selfieBlobUrl" :src="selfieBlobUrl" alt="Tenant Photo"
              class="w-20 h-20 rounded-full object-cover border-4 border-gray-200 shadow-md" />
            <div v-else
              class="w-20 h-20 rounded-full bg-gray-200 border-4 border-gray-200 shadow-md flex items-center justify-center">
              <svg class="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          </div>

          <!-- Name & Email -->
          <div class="flex flex-col justify-center">
            <div>
              <p class="text-sm text-gray-500">Tenant Name</p>
              <p class="font-semibold text-gray-900 text-lg">
                {{ reference?.tenant_first_name }} {{ reference?.tenant_last_name }}
              </p>
            </div>
            <div class="mt-1">
              <p class="text-sm text-gray-500">Email</p>
              <p class="font-medium text-gray-900">
                {{ reference?.tenant_email }}
              </p>
            </div>
          </div>
        </div>

        <!-- Other reference details in one line -->
        <div class="flex flex-wrap items-center gap-6 text-sm">
          <div>
            <p class="text-xs text-gray-500 mb-1">Property</p>
            <p class="font-medium text-gray-900">{{ reference?.property_address }}</p>
          </div>
          <div>
            <p class="text-xs text-gray-500 mb-1">Status</p>
            <span :class="getStatusChipClasses(reference?.status)"
              class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold">
              {{ formatStatusText(reference?.status) }}
            </span>
          </div>
          <div v-if="reference?.submitted_ip_address">
            <p class="text-xs text-gray-500 mb-1">Submitted IP</p>
            <p class="font-mono text-gray-900">{{ reference.submitted_ip_address }}</p>
          </div>
          <div v-if="reference?.submitted_geolocation" class="relative group">
            <p class="text-xs text-gray-500 mb-1">Approximate Location</p>
            <button type="button" class="flex items-center gap-1 text-primary hover:text-primary-dark transition-colors"
              :title="formatGeolocationText(reference.submitted_geolocation)"
              @click="openGeolocationMap(reference.submitted_geolocation)">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span class="text-xs">View Map</span>
            </button>
            <!-- Tooltip on hover -->
            <div
              class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              {{ formatGeolocationText(reference.submitted_geolocation) }}
              <div
                class="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900">
              </div>
            </div>
          </div>
        </div>

        <!-- System Suggestion -->
        <div class="mt-4 pt-4 border-t border-gray-200">
          <p class="text-xs text-gray-500 mb-2">System Suggestion</p>
          <div class="space-y-3">
            <!-- Decision -->
            <div>
              <p class="text-xs text-gray-500 mb-1">Decision</p>
              <span v-if="systemDecision" :class="getStatusChipClasses(systemDecision)"
                class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold">
                {{ formatStatusText(systemDecision) }}
              </span>
              <span v-else
                class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                Not available
              </span>
            </div>
            <!-- Risk Score -->
            <!-- <div>
              <p class="text-xs text-gray-500 mb-1">Risk Score</p>
              <p class="text-lg font-semibold text-gray-900">{{ riskScore ?? '—' }}</p>
            </div> -->
            <!-- Risk Level -->
            <!-- <div>
              <p class="text-xs text-gray-500 mb-1">Risk Level</p>
              <span v-if="creditAndAmlVerification?.verification?.risk_level" :class="[
                'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold',
                creditAndAmlVerification.verification.risk_level === 'very_high' ? 'bg-red-100 text-red-800' :
                  creditAndAmlVerification.verification.risk_level === 'high' ? 'bg-orange-100 text-orange-800' :
                    creditAndAmlVerification.verification.risk_level === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      creditAndAmlVerification.verification.risk_level === 'low' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
              ]">
                {{ creditAndAmlVerification.verification.risk_level.toUpperCase().replace('_', ' ') }}
              </span>
              <span v-else
                class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                Not available
              </span>
            </div> -->
            <!-- Critical Flags -->
            <div>
              <p class="text-xs text-gray-500 mb-1">Critical Flags</p>
              <div v-if="activeGates.length > 0" class="flex flex-wrap gap-2">
                <span v-for="gate in activeGates" :key="gate.key"
                  class="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-300">
                  {{ gate.label }}
                </span>
              </div>
              <div v-else
                class="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded px-2 py-1 inline-block">
                None
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Guarantor Information Card -->
      <div v-if="guarantorReference && guarantorReference.submitted_at"
        class="bg-purple-50 border border-purple-200 rounded-lg shadow p-6 mb-6">
        <h3 class="text-lg font-semibold text-purple-900 mb-4">Guarantor Information</h3>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div>
            <p class="text-sm text-purple-700 font-medium">Name</p>
            <p class="font-medium text-purple-900">{{ guarantorReference.guarantor_first_name }} {{
              guarantorReference.guarantor_last_name }}</p>
          </div>
          <div>
            <p class="text-sm text-purple-700 font-medium">Email</p>
            <p class="font-medium text-purple-900">{{ guarantorReference.email }}</p>
          </div>
          <div>
            <p class="text-sm text-purple-700 font-medium">Phone</p>
            <p class="font-medium text-purple-900">{{ guarantorReference.contact_number }}</p>
          </div>
          <div>
            <p class="text-sm text-purple-700 font-medium">Relationship</p>
            <p class="font-medium text-purple-900 capitalize">{{ guarantorReference.relationship_to_tenant }}</p>
          </div>
        </div>
        <div v-if="guarantorReference.submitted_ip_address || guarantorReference.submitted_geolocation"
          class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div v-if="guarantorReference.submitted_ip_address">
            <p class="text-sm text-purple-700 font-medium">Submitted IP</p>
            <p class="font-mono text-sm text-purple-900">{{ guarantorReference.submitted_ip_address }}</p>
          </div>
          <div v-if="guarantorReference.submitted_geolocation">
            <p class="text-sm text-purple-700 font-medium">Approximate Location</p>
            <div class="flex items-center gap-2 text-sm text-purple-900">
              {{ formatGeolocationText(guarantorReference.submitted_geolocation) }}
              <button type="button" class="text-xs text-purple-700 underline"
                @click="openGeolocationMap(guarantorReference.submitted_geolocation)">
                Map
              </button>
            </div>
          </div>
        </div>

        <!-- Guarantor Documents -->
        <div
          v-if="guarantorReference.id_document_path || guarantorReference.selfie_path || guarantorReference.proof_of_address_path || guarantorReference.bank_statement_path"
          class="mt-4 pt-4 border-t border-purple-300">
          <h4 class="text-sm font-semibold text-purple-800 mb-3">Guarantor Documents</h4>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div v-if="guarantorReference.id_document_path"
              class="flex items-center justify-between bg-white px-3 py-2 rounded border border-purple-200">
              <span class="text-sm text-purple-900">ID Document</span>
              <a :href="`${API_URL}/api/staff/download-guarantor/${guarantorReference.id}/${guarantorReference.id_document_path.split('/').pop()}`"
                target="_blank" class="text-xs text-purple-600 hover:text-purple-800 underline">View</a>
            </div>
            <div v-if="guarantorReference.selfie_path"
              class="flex items-center justify-between bg-white px-3 py-2 rounded border border-purple-200">
              <span class="text-sm text-purple-900">Selfie</span>
              <a :href="`${API_URL}/api/staff/download-guarantor/${guarantorReference.id}/${guarantorReference.selfie_path.split('/').pop()}`"
                target="_blank" class="text-xs text-purple-600 hover:text-purple-800 underline">View</a>
            </div>
            <div v-if="guarantorReference.proof_of_address_path"
              class="flex items-center justify-between bg-white px-3 py-2 rounded border border-purple-200">
              <span class="text-sm text-purple-900">Proof of Address</span>
              <a :href="`${API_URL}/api/staff/download-guarantor/${guarantorReference.id}/${guarantorReference.proof_of_address_path.split('/').pop()}`"
                target="_blank" class="text-xs text-purple-600 hover:text-purple-800 underline">View</a>
            </div>
            <div v-if="guarantorReference.bank_statement_path"
              class="flex items-center justify-between bg-white px-3 py-2 rounded border border-purple-200">
              <span class="text-sm text-purple-900">Bank Statement</span>
              <a :href="`${API_URL}/api/staff/download-guarantor/${guarantorReference.id}/${guarantorReference.bank_statement_path.split('/').pop()}`"
                target="_blank" class="text-xs text-purple-600 hover:text-purple-800 underline">View</a>
            </div>
          </div>
        </div>

        <!-- Guarantor Financial Summary -->
        <div v-if="guarantorReference.annual_income || guarantorReference.savings_amount"
          class="mt-4 pt-4 border-t border-purple-300">
          <h4 class="text-sm font-semibold text-purple-800 mb-3">Financial Summary</h4>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div v-if="guarantorReference.annual_income">
              <p class="text-sm text-purple-700 font-medium">Annual Income</p>
              <p class="font-medium text-purple-900">£{{ parseFloat(guarantorReference.annual_income ||
                '0').toLocaleString('en-GB') }}</p>
            </div>
            <div v-if="guarantorReference.savings_amount">
              <p class="text-sm text-purple-700 font-medium">Savings</p>
              <p class="font-medium text-purple-900">£{{ parseFloat(guarantorReference.savings_amount ||
                '0').toLocaleString('en-GB') }}</p>
            </div>
            <div v-if="guarantorReference.employment_status">
              <p class="text-sm text-purple-700 font-medium">Employment Status</p>
              <p class="font-medium text-purple-900 capitalize">{{ guarantorReference.employment_status }}</p>
            </div>
            <div v-if="guarantorReference.home_ownership_status">
              <p class="text-sm text-purple-700 font-medium">Home Ownership</p>
              <p class="font-medium text-purple-900 capitalize">{{ guarantorReference.home_ownership_status }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Step Content -->
      <div class="bg-white rounded-lg shadow p-6">

        <!-- Step 1: Identity Verification -->
        <div v-if="currentStep === 1">
          <div class="flex items-start justify-between mb-4 gap-4">
            <div>
              <h3 class="text-xl font-bold text-gray-900">Step 1: Identity Verification</h3>
              <p class="text-gray-600 mt-1">
                Compare the tenant's ID document and selfie, and confirm their identity matches the application details.
              </p>
            </div>
            <div v-if="reference?.nationality" class="shrink-0">
              <p class="text-xs text-gray-500 mb-1 text-right">Nationality</p>
              <span
                class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-800 border border-indigo-100">
                {{ reference.nationality }}
              </span>
            </div>
          </div>

          <div class="space-y-6">
            <!-- Document vs Selfie comparison -->
            <SideBySideViewer :left-image-url="idDocumentBlobUrl" :right-image-url="selfieBlobUrl"
              left-title="ID Document" right-title="Selfie">
              <!-- ID Document upload/request buttons -->
              <template #left-content>
                <div v-if="!reference?.id_document_path" class="mt-3 flex justify-center gap-2">
                  <label class="px-3 py-1.5 text-xs font-medium text-white bg-primary hover:bg-primary/90 rounded-md cursor-pointer">
                    <input type="file" class="hidden" accept=".pdf,.jpg,.jpeg,.png" @change="(e) => handleStaffUpload(e, 'id_document')">
                    Upload
                  </label>
                  <button type="button" @click="openRequestDocumentModal('id_document')"
                    class="px-3 py-1.5 text-xs font-medium text-primary bg-white border border-primary hover:bg-primary/5 rounded-md">
                    Request from Tenant
                  </button>
                </div>
              </template>
              <!-- Selfie upload/request buttons -->
              <template #right-content>
                <div v-if="!reference?.selfie_path" class="mt-3 flex justify-center gap-2">
                  <label class="px-3 py-1.5 text-xs font-medium text-white bg-primary hover:bg-primary/90 rounded-md cursor-pointer">
                    <input type="file" class="hidden" accept=".pdf,.jpg,.jpeg,.png" @change="(e) => handleStaffUpload(e, 'selfie')">
                    Upload
                  </label>
                  <button type="button" @click="openRequestDocumentModal('selfie')"
                    class="px-3 py-1.5 text-xs font-medium text-primary bg-white border border-primary hover:bg-primary/5 rounded-md">
                    Request from Tenant
                  </button>
                </div>
              </template>
            </SideBySideViewer>

            <!-- Key identity details -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="bg-gray-50 rounded p-4">
                <p class="text-sm font-medium text-gray-700">Full Name</p>
                <p class="mt-1 text-sm text-gray-900">
                  {{ reference?.tenant_first_name }} {{ reference?.tenant_last_name }}
                </p>
              </div>
              <div class="bg-gray-50 rounded p-4">
                <p class="text-sm font-medium text-gray-700">Date of Birth</p>
                <p class="mt-1 text-sm text-gray-900">
                  {{ formatDate(reference?.date_of_birth, 'Not provided') }}
                </p>
              </div>
            </div>

            <!-- External Reference Responses -->
            <!-- <div v-if="accountantReference" class="space-y-4">
              <div class="bg-white border rounded-lg p-4">
                <h4 class="font-semibold text-gray-900 mb-3">Accountant Reference Response</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <p class="text-xs text-gray-500 uppercase tracking-wide">Firm</p>
                    <p class="font-medium text-gray-900">{{ accountantReference.accountant_firm }}</p>
                  </div>
                  <div>
                    <p class="text-xs text-gray-500 uppercase tracking-wide">Contact</p>
                    <p class="font-medium text-gray-900">{{ accountantReference.accountant_name }}</p>
                    <p class="text-gray-600">{{ accountantReference.accountant_email }}</p>
                  </div>
                  <div>
                    <p class="text-xs text-gray-500 uppercase tracking-wide">Business</p>
                    <p class="font-medium text-gray-900">{{ accountantReference.business_name }}</p>
                  </div>
                  <div>
                    <p class="text-xs text-gray-500 uppercase tracking-wide">Annual Turnover</p>
                    <p class="font-medium text-gray-900">{{ accountantReference.annual_turnover }}</p>
                  </div>
                  <div>
                    <p class="text-xs text-gray-500 uppercase tracking-wide">Estimated Monthly Income</p>
                    <p class="font-medium text-gray-900">{{ accountantReference.estimated_monthly_income }}</p>
                  </div>
                  <div>
                    <p class="text-xs text-gray-500 uppercase tracking-wide">Recommendation</p>
                    <p class="font-medium text-gray-900">{{ formatBooleanDisplay(accountantReference.would_recommend) }}
                    </p>
                  </div>
                </div>
                <div v-if="accountantReference.additional_comments" class="mt-3 text-sm text-gray-900">
                  <p class="text-xs text-gray-500 uppercase tracking-wide">Comments</p>
                  <p class="whitespace-pre-line">{{ accountantReference.additional_comments }}</p>
                </div>
                <div v-if="accountantReference.signature" class="mt-3">
                  <p class="text-xs text-gray-500 uppercase tracking-wide mb-1">Signature</p>
                  <img :src="accountantReference.signature" alt="Accountant signature"
                    class="h-20 object-contain border rounded bg-white p-2" />
                </div>
                <div v-if="accountantReference.submitted_ip_address || accountantReference.submitted_geolocation"
                  class="mt-3 text-xs text-gray-500 space-y-1">
                  <p v-if="accountantReference.submitted_ip_address">IP: {{ accountantReference.submitted_ip_address }}
                  </p>
                  <p v-if="accountantReference.submitted_geolocation" class="flex items-center gap-2">
                    Location: {{ formatGeolocationText(accountantReference.submitted_geolocation) }}
                    <button type="button" class="text-primary underline"
                      @click="openGeolocationMap(accountantReference.submitted_geolocation)">
                      Map
                    </button>
                  </p>
                </div>
              </div>
            </div> -->

            <!-- Signature -->
            <div v-if="reference?.consent_signature" class="mb-6">
              <label class="block text-sm font-medium text-gray-700 mb-2">Signature</label>
              <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <img :src="reference.consent_signature" alt="Consent Signature"
                  class="max-w-xs h-24 object-contain border rounded bg-white p-2" />
              </div>
            </div>

            <!-- Notes -->
            <div>
              <p class="text-xs text-gray-500 mb-1">External Notes - these notes will be shown to the reference creator</p>
              <label class="block text-sm font-medium text-gray-700 mb-2">Notes</label>
              <textarea v-model="steps[0]!.notes" rows="3"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                placeholder="Record any observations about the ID document and selfie (e.g. quality, discrepancies, additional checks performed)."></textarea>
            </div>


            <!-- Pass/Fail -->
            <div>
              <p class="text-sm text-gray-700 mb-3">
                Please confirm you are satisfied that the ID document and selfie belong to the same person and that the
                details above match the application before recording a Pass or Fail decision.
              </p>
              <div class="flex gap-4">
                <button @click="steps[0]!.overall_pass = true" :class="[
                  'flex-1 py-3 px-4 rounded-md font-medium transition-all',
                  steps[0]!.overall_pass === true
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-green-50'
                ]">
                  Pass - Identity confirmed
                </button>
                <button @click="steps[0]!.overall_pass = false" :class="[
                  'flex-1 py-3 px-4 rounded-md font-medium transition-all',
                  steps[0]!.overall_pass === false
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-red-50'
                ]">
                  Fail - Identity not confirmed
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Step 2: RTR Verification -->
        <div v-if="currentStep === 2">
          <div class="flex items-center gap-4 mb-4">
            <h3 class="text-xl font-bold text-gray-900">Step 2: RTR Verification</h3>
            <span
              class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-800 border border-purple-100">
              RTR Score: {{ domainScores.rtr ?? '—' }}
            </span>
            <span :class="[
              'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold',
              reference?.rtr_verified ? 'bg-green-50 text-green-800 border border-green-100' : 'bg-red-50 text-red-800 border border-red-100'
            ]">
              {{ reference?.rtr_verified ? '✓ Verified' : '✗ Not Verified' }}
            </span>
          </div>
          <p class="text-gray-600 mb-6">Verify the tenant's Right to Rent status.</p>

          <div class="space-y-6">
            <!-- Tenant Nationality -->
            <div class="bg-white border rounded-lg p-4">
              <h4 class="font-semibold text-gray-900 mb-3">Tenant Nationality</h4>
              <div class="flex items-center gap-3">
                <span
                  class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-800 border border-indigo-100">
                  {{ reference?.nationality || 'Not provided' }}
                </span>
              </div>
            </div>

            <!-- British Citizen Check -->
            <div v-if="isBritishCitizen" class="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div class="flex items-start gap-3">
                <svg class="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor"
                  viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h4 class="font-semibold text-blue-900 mb-1">British Citizen</h4>
                  <p class="text-sm text-blue-800">
                    Tenant is a British citizen. No need to verify Right to Rent.
                  </p>
                </div>
              </div>
            </div>

            <!-- RTR Share Code (if provided and not British) -->
            <div v-if="reference?.rtr_share_code" class="bg-white border relative rounded-lg p-4">
              <h4 class="font-semibold text-gray-900 mb-3">Right to Rent Share Code</h4>
              <div class="flex items-center gap-3">
                <div class="flex-1">
                  <p class="text-sm text-gray-600 mb-2">Share Code</p>
                  <div class="flex items-center gap-2">
                    <code
                      class="px-4 py-2 bg-gray-100 border border-gray-300 rounded-md font-mono text-lg font-semibold text-gray-900">
                      {{ reference.rtr_share_code }}
                    </code>
                    <!-- <button type="button"
                      class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-dark rounded-md transition-colors">
                      Verify
                    </button> -->
                  </div>
                  <!-- <p class="text-xs text-gray-500 mt-2">
                    Click "Verify" to check the Right to Rent status using the share code.
                  </p> -->
                </div>
              </div>
            </div>

            <!-- Alternative Document (if share code not provided and not British) -->
            <div v-if="reference?.rtr_alternative_document_path && reference?.rtr_alternative_document_type"
              class="bg-white border rounded-lg p-4">
              <h4 class="font-semibold text-gray-900 mb-3">Alternative Right to Rent Document</h4>
              <div class="space-y-4">
                <div>
                  <p class="text-sm text-gray-600 mb-1">Document Type</p>
                  <p class="font-medium text-gray-900">{{ reference.rtr_alternative_document_type }}</p>
                </div>
                <div>
                  <p class="text-sm text-gray-600 mb-2">Document Preview</p>
                  <div class="h-96 border rounded-md overflow-hidden bg-gray-50 flex items-center justify-center">
                    <template v-if="rtrAlternativeDocumentBlobUrl">
                      <iframe v-if="rtrAlternativeDocumentIsPdf"
                        :src="rtrAlternativeDocumentBlobUrl"
                        class="w-full h-full"
                        style="min-height: 384px;"
                        frameborder="0"
                      ></iframe>
                      <img v-else :src="rtrAlternativeDocumentBlobUrl" class="max-w-full max-h-full object-contain" alt="RTR Alternative Document" />
                    </template>
                    <div v-else class="flex items-center justify-center h-full text-xs text-gray-500">
                      Loading document preview...
                    </div>
                  </div>
                  <div class="mt-2 flex justify-end">
                    <a v-if="rtrAlternativeDocumentBlobUrl" :href="rtrAlternativeDocumentBlobUrl"
                      target="_blank" class="text-xs text-primary hover:text-primary-dark underline">
                      Open in new tab
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <!-- No RTR Information -->
            <div v-else class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div class="flex items-start gap-3">
                <svg class="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor"
                  viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <h4 class="font-semibold text-yellow-900 mb-1">No Right to Rent Information</h4>
                  <p class="text-sm text-yellow-800">
                    No share code or alternative document has been provided for Right to Rent verification.
                  </p>
                </div>
              </div>
            </div>

            <!-- Notes -->
            <div class="bg-white border rounded-lg p-4">
              <p class="text-xs text-gray-500 mb-1">External Notes - these notes will be shown to the reference creator</p>
              <label class="block text-sm font-medium text-gray-700 mb-2">Notes</label>
              <textarea v-model="steps[1]!.notes" rows="3"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                placeholder="Record any observations about the Right to Rent verification (e.g. share code verification results, document review notes, additional checks performed)."></textarea>
            </div>

            <!-- Pass/Fail Buttons -->
            <div class="bg-white border rounded-lg p-4">
              <h4 class="font-semibold text-gray-900 mb-3">Verification Decision</h4>
              <div class="flex gap-4">
                <button @click="steps[1]!.overall_pass = true" :class="[
                  'flex-1 py-3 px-4 rounded-md font-medium transition-all',
                  steps[1]!.overall_pass === true
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-green-50'
                ]">
                  Pass
                </button>
                <button @click="steps[1]!.overall_pass = false" :class="[
                  'flex-1 py-3 px-4 rounded-md font-medium transition-all',
                  steps[1]!.overall_pass === false
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-red-50'
                ]">
                  Fail
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Step 3: Income & Affordability -->
        <div v-if="currentStep === 3">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-xl font-bold text-gray-900">Step 3: Income & Affordability</h3>
            <span
              class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-100">
              Income Score: {{ domainScores.income ?? '—' }}
            </span>
          </div>
          <p class="text-gray-600 mb-6">Review all available financial information to assess income and affordability.
          </p>

          <div class="space-y-6">
            <!-- Property Details Section (Moved from Income Sources) -->
            <div v-if="reference?.monthly_rent || reference?.rent_share" class="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 class="font-semibold text-gray-900 mb-3">Property Details</h4>
              <div class="space-y-1 text-sm">
                <p v-if="reference?.rent_share">
                  <strong>Rent Share:</strong> £{{ reference.rent_share }}
                  <span v-if="reference.monthly_rent && parseFloat(reference.monthly_rent) !== parseFloat(reference.rent_share)" class="text-gray-600">
                    (of £{{ reference.monthly_rent }} total)
                  </span>
                </p>
                <p v-else-if="reference?.monthly_rent"><strong>Monthly Rent:</strong> £{{ reference.monthly_rent }}</p>
                <p v-if="reference?.property_address"><strong>Property:</strong> {{ reference.property_address }}, {{
                  reference.property_city }} {{ reference.property_postcode }}</p>
              </div>
            </div>

            <!-- Financial Information (from ReferenceDetail) -->
            <div class="bg-white rounded-lg shadow p-6">
              <h4 class="text-lg font-semibold text-gray-900 mb-4">Financial Information</h4>

              <!-- Income Sources -->
              <div class="mb-6">
                <label class="block text-sm font-medium text-gray-700 mb-3">Income Sources</label>
                <div class="flex flex-wrap gap-2">
                  <span v-if="reference?.income_regular_employment"
                    class="px-3 py-1 text-xs sm:text-sm bg-blue-100 text-blue-800 rounded-full">Employed</span>
                  <span v-if="reference?.income_self_employed"
                    class="px-3 py-1 text-xs sm:text-sm bg-blue-100 text-blue-800 rounded-full">Self Employed</span>
                  <span v-if="reference?.income_benefits"
                    class="px-3 py-1 text-xs sm:text-sm bg-blue-100 text-blue-800 rounded-full">Benefits</span>
                  <span v-if="reference?.income_savings_pension_investments"
                    class="px-3 py-1 text-xs sm:text-sm bg-blue-100 text-blue-800 rounded-full">Savings/Pension/Investments</span>
                  <span v-if="reference?.income_student"
                    class="px-3 py-1 text-xs sm:text-sm bg-blue-100 text-blue-800 rounded-full">Student</span>
                  <span v-if="reference?.income_unemployed"
                    class="px-3 py-1 text-xs sm:text-sm bg-blue-100 text-blue-800 rounded-full">Unemployed</span>
                  <span
                    v-if="!reference?.income_regular_employment && !reference?.income_self_employed && !reference?.income_benefits && !reference?.income_savings_pension_investments && !reference?.income_student && !reference?.income_unemployed"
                    class="text-gray-500 text-sm">Not provided yet</span>
                </div>

                <!-- Student / Unemployed info for guarantor context -->
                <div v-if="reference?.income_student || reference?.income_unemployed"
                  class="mt-3 p-3 rounded-md bg-yellow-50 border border-yellow-200 text-sm text-yellow-900">
                  The tenant has declared themselves as
                  <strong>{{ reference?.income_student ? 'student' : 'unemployed' }}</strong>, therefore a guarantor
                  may be required depending on the overall assessment.
                </div>
              </div>

              <!-- Employment Details -->
              <div v-if="reference?.income_regular_employment" class="border-t pt-6">
                <h5 class="text-md font-semibold text-gray-900 mb-4">Employment Details</h5>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p class="text-gray-500 font-medium">Employment Type</p>
                    <p class="mt-1 text-gray-900 capitalize">
                      {{ reference?.employment_contract_type?.replace(/-/g, ' ') || 'Not provided' }}
                    </p>
                  </div>
                  <div>
                    <p class="text-gray-500 font-medium">Employment Start Date</p>
                    <p class="mt-1 text-gray-900">
                      {{ reference?.employment_start_date ? formatDate(reference.employment_start_date) : 'Not provided'
                      }}
                    </p>
                  </div>
                  <div>
                    <p class="text-gray-500 font-medium">Compensation Type</p>
                    <p class="mt-1 text-gray-900">
                      {{ reference?.employment_is_hourly ? 'Hourly' : 'Salary' }}
                    </p>
                  </div>
                  <div v-if="reference?.employment_is_hourly">
                    <p class="text-gray-500 font-medium">Hourly Rate</p>
                    <p class="mt-1 text-gray-900">
                      {{ reference?.employment_salary_amount ? `£${reference.employment_salary_amount}/hour` : 'Not provided' }}
                    </p>
                  </div>
                  <div v-if="reference?.employment_is_hourly">
                    <p class="text-gray-500 font-medium">Hours per Month</p>
                    <p class="mt-1 text-gray-900">
                      {{ reference?.employment_hours_per_month || 'Not provided' }}
                    </p>
                  </div>
                  <div v-if="!reference?.employment_is_hourly">
                    <p class="text-gray-500 font-medium">Annual Salary</p>
                    <p class="mt-1 text-gray-900">
                      {{ reference?.employment_salary_amount ? `£${reference.employment_salary_amount}` : 'Not provided'
                      }}
                    </p>
                  </div>
                  <div>
                    <p class="text-gray-500 font-medium">Job Title</p>
                    <p class="mt-1 text-gray-900">{{ reference?.employment_job_title || 'Not provided' }}</p>
                  </div>
                  <div>
                    <p class="text-gray-500 font-medium">Company Name</p>
                    <p class="mt-1 text-gray-900">{{ reference?.employment_company_name || 'Not provided' }}</p>
                  </div>
                  <div class="md:col-span-2">
                    <p class="text-gray-500 font-medium">Company Address</p>
                    <p class="mt-1 text-gray-900">
                      {{ reference?.employment_company_address_line1 || 'Not provided' }}
                      <span v-if="reference?.employment_company_address_line2">, {{
                        reference.employment_company_address_line2 }}</span>
                    </p>
                  </div>
                  <div>
                    <p class="text-gray-500 font-medium">Company City</p>
                    <p class="mt-1 text-gray-900">{{ reference?.employment_company_city || 'Not provided' }}</p>
                  </div>
                  <div>
                    <p class="text-gray-500 font-medium">Company Postcode</p>
                    <p class="mt-1 text-gray-900">{{ reference?.employment_company_postcode || 'Not provided' }}</p>
                  </div>
                </div>

                <!-- Payslips -->
                <div class="mt-6">
                  <p class="block text-sm font-medium text-gray-700 mb-3">Payslips (Last 3 months)</p>
                  <div v-if="reference?.payslip_files?.length" class="space-y-2">
                    <div v-for="(file, index) in reference.payslip_files" :key="index"
                      class="flex items-center justify-between bg-gray-50 px-4 py-3 rounded-lg">
                      <div class="flex items-center">
                        <svg class="w-5 h-5 text-gray-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <span class="text-sm text-gray-900">Payslip {{ index + 1 }}</span>
                      </div>
                      <div class="flex gap-2">
                        <button type="button" @click="previewPayslip(file, index)"
                          class="px-3 py-1 text-xs sm:text-sm font-medium text-primary bg-white border border-primary hover:bg-primary/5 rounded-md">
                          Preview
                        </button>
                      </div>
                    </div>
                  </div>
                  <div v-else class="bg-gray-50 rounded-lg p-4">
                    <p class="text-gray-500 text-center text-sm mb-3">Payslips not uploaded yet</p>
                    <div class="flex justify-center gap-2">
                      <label class="px-3 py-1.5 text-xs font-medium text-white bg-primary hover:bg-primary/90 rounded-md cursor-pointer">
                        <input type="file" class="hidden" accept=".pdf,.jpg,.jpeg,.png" @change="(e) => handleStaffUpload(e, 'payslips')">
                        Upload
                      </label>
                      <button type="button" @click="openRequestDocumentModal('payslips')"
                        class="px-3 py-1.5 text-xs font-medium text-primary bg-white border border-primary hover:bg-primary/5 rounded-md">
                        Request from Tenant
                      </button>
                    </div>
                  </div>

                  <!-- Embedded payslip viewer -->
                  <div v-if="payslipPreviewUrl" class="mt-4 border rounded-lg overflow-hidden bg-gray-50">
                    <div class="flex items-center justify-between px-4 py-2 border-b bg-white">
                      <p class="text-sm font-medium text-gray-700">
                        Payslip preview
                      </p>
                      <button type="button" class="text-xs text-gray-500 hover:text-gray-700"
                        @click="clearPayslipPreview">
                        Close preview
                      </button>
                    </div>
                    <div class="h-[480px]">
                      <iframe :src="payslipPreviewUrl" class="w-full h-full" frameborder="0"></iframe>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Self-Employed Details -->
            <div v-if="reference?.income_self_employed" class="border-t pt-6 mt-6">
              <h5 class="text-md font-semibold text-gray-900 mb-4">Self-Employed Details</h5>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p class="text-gray-500 font-medium">Business Name</p>
                  <p class="mt-1 text-gray-900">{{ reference?.self_employed_business_name || 'Not provided' }}</p>
                </div>
                <div>
                  <p class="text-gray-500 font-medium">Business Start Date</p>
                  <p class="mt-1 text-gray-900">{{ reference?.self_employed_start_date ?
                    formatDate(reference.self_employed_start_date) : 'Not provided' }}</p>
                </div>
                <div>
                  <p class="text-gray-500 font-medium">Nature of Business</p>
                  <p class="mt-1 text-gray-900">{{ reference?.self_employed_nature_of_business || 'Not provided' }}</p>
                </div>
                <div>
                  <p class="text-gray-500 font-medium">Annual Income</p>
                  <p class="mt-1 text-gray-900">{{ reference?.self_employed_annual_income ?
                    `£${parseFloat(reference.self_employed_annual_income || '0').toLocaleString('en-GB')}` : 'Not provided' }}
                  </p>
                </div>
              </div>

              <!-- Accountant Contact -->
              <div class="mt-6 pt-6 border-t">
                <h5 class="text-sm font-semibold text-gray-700 mb-3">Accountant Contact</h5>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p class="text-gray-500 font-medium">Accountant/Firm Name</p>
                    <p class="mt-1 text-gray-900">{{ reference?.accountant_name || 'Not provided' }}</p>
                  </div>
                  <div>
                    <p class="text-gray-500 font-medium">Contact Name</p>
                    <p class="mt-1 text-gray-900">{{ reference?.accountant_contact_name || 'Not provided' }}</p>
                  </div>
                  <div>
                    <p class="text-gray-500 font-medium">Email</p>
                    <p class="mt-1 text-gray-900">{{ reference?.accountant_email || 'Not provided' }}</p>
                  </div>
                  <div>
                    <p class="text-gray-500 font-medium">Phone</p>
                    <p class="mt-1 text-gray-900">{{ reference?.accountant_phone || 'Not provided' }}</p>
                  </div>
                </div>
              </div>

              <!-- Tax Return Document -->
              <div class="mt-6 pt-6 border-t">
                <p class="block text-sm font-medium text-gray-700 mb-2">Tax Return Proof</p>
                <div v-if="reference?.tax_return_path">
                  <div class="flex items-center justify-between bg-gray-50 px-4 py-3 rounded-lg">
                    <div class="flex items-center">
                      <svg class="w-5 h-5 text-gray-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      <span class="text-sm text-gray-900">Tax Return Document</span>
                    </div>
                    <div class="flex gap-2">
                      <button type="button" @click="previewTaxReturn(reference.tax_return_path)"
                        class="px-3 py-1 text-xs sm:text-sm font-medium text-primary bg-white border border-primary hover:bg-primary/5 rounded-md">
                        Preview
                      </button>
                    </div>
                  </div>

                  <!-- Embedded tax return viewer -->
                  <div v-if="taxReturnPreviewUrl" class="mt-4 border rounded-lg overflow-hidden bg-gray-50">
                    <div class="flex items-center justify-between px-4 py-2 border-b bg-white">
                      <p class="text-sm font-medium text-gray-700">
                        Tax return preview
                      </p>
                      <button type="button" class="text-xs text-gray-500 hover:text-gray-700"
                        @click="clearTaxReturnPreview">
                        Close preview
                      </button>
                    </div>
                    <div class="h-[480px]">
                      <iframe :src="taxReturnPreviewUrl" class="w-full h-full" frameborder="0"></iframe>
                    </div>
                  </div>
                </div>
                <div v-else class="bg-gray-50 rounded-lg p-4">
                  <p class="text-gray-500 text-center text-sm mb-3">Tax return not uploaded yet</p>
                  <div class="flex justify-center gap-2">
                    <label class="px-3 py-1.5 text-xs font-medium text-white bg-primary hover:bg-primary/90 rounded-md cursor-pointer">
                      <input type="file" class="hidden" accept=".pdf,.jpg,.jpeg,.png" @change="(e) => handleStaffUpload(e, 'tax_return')">
                      Upload
                    </label>
                    <button type="button" @click="openRequestDocumentModal('tax_return')"
                      class="px-3 py-1.5 text-xs font-medium text-primary bg-white border border-primary hover:bg-primary/5 rounded-md">
                      Request from Tenant
                    </button>
                  </div>
                </div>
              </div>

              <!-- Accountant Reference Submitted -->
              <div v-if="accountantReference && accountantReference.submitted_at"
                class="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
                <div class="flex items-center justify-between mb-4">
                  <h4 class="text-lg font-semibold text-green-900">✓ Accountant Reference Completed</h4>
                  <span class="text-xs text-green-700">Submitted {{ formatDate(accountantReference.submitted_at)
                    }}</span>
                </div>

                <div class="space-y-4">
                  <!-- Accountant Information -->
                  <div>
                    <h5 class="text-sm font-semibold text-green-800 mb-2">Accountant Information</h5>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div><span class="text-green-700 font-medium">Name:</span> <span class="text-green-900">{{
                        accountantReference.accountant_name }}</span></div>
                      <div><span class="text-green-700 font-medium">Firm:</span> <span class="text-green-900">{{
                        accountantReference.accountant_firm || accountantReference.firm_name }}</span></div>
                      <div><span class="text-green-700 font-medium">Email:</span> <span class="text-green-900">{{
                        accountantReference.accountant_email }}</span></div>
                      <div v-if="accountantReference.accountant_phone"><span
                          class="text-green-700 font-medium">Phone:</span>
                        <span class="text-green-900">{{
                          accountantReference.accountant_phone }}</span>
                      </div>
                    </div>
                  </div>

                  <!-- Business Details -->
                  <div>
                    <h5 class="text-sm font-semibold text-green-800 mb-2">Business Information</h5>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div v-if="accountantReference.business_name"><span class="text-green-700 font-medium">Business
                          Name:</span>
                        <span class="text-green-900">{{
                          accountantReference.business_name }}</span>
                      </div>
                      <div v-if="accountantReference.business_trading_status"><span
                          class="text-green-700 font-medium">Trading
                          Status:</span> <span class="text-green-900 capitalize">{{
                            accountantReference.business_trading_status
                          }}</span>
                      </div>
                      <div v-if="accountantReference.business_start_date"><span class="text-green-700 font-medium">Start
                          Date:</span>
                        <span class="text-green-900">{{
                          formatDate(accountantReference.business_start_date) }}</span>
                      </div>
                      <div v-if="accountantReference.nature_of_business"><span
                          class="text-green-700 font-medium">Nature:</span>
                        <span class="text-green-900">{{
                          accountantReference.nature_of_business }}</span>
                      </div>
                    </div>
                  </div>

                  <!-- Financial Details -->
                  <div class="pt-3 border-t border-green-200">
                    <h5 class="text-sm font-semibold text-green-800 mb-2">Financial Information</h5>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div v-if="accountantReference.annual_turnover"><span class="text-green-700 font-medium">Annual
                          Turnover:</span>
                        <span class="text-green-900">£{{
                          parseFloat(accountantReference.annual_turnover || '0').toLocaleString('en-GB') }}</span>
                      </div>
                      <div v-if="accountantReference.annual_profit"><span class="text-green-700 font-medium">Annual
                          Profit:</span>
                        <span class="text-green-900">£{{
                          parseFloat(accountantReference.annual_profit || '0').toLocaleString('en-GB') }}</span>
                      </div>
                      <div v-if="accountantReference.estimated_monthly_income"><span
                          class="text-green-700 font-medium">Est.
                          Monthly Income:</span> <span class="text-green-900">£{{
                            parseFloat(accountantReference.estimated_monthly_income || '0').toLocaleString('en-GB')
                          }}</span></div>
                      <div v-if="accountantReference.tax_returns_filed !== undefined"><span
                          class="text-green-700 font-medium">Tax Returns Filed:</span> <span class="text-green-900">{{
                            accountantReference.tax_returns_filed ? 'Yes' : 'No' }}</span></div>
                      <div v-if="accountantReference.last_tax_return_date"><span class="text-green-700 font-medium">Last
                          Tax
                          Return:</span> <span class="text-green-900">{{
                            formatDate(accountantReference.last_tax_return_date) }}</span></div>
                      <div v-if="accountantReference.accounts_prepared !== undefined"><span
                          class="text-green-700 font-medium">Accounts Prepared:</span> <span class="text-green-900">{{
                            accountantReference.accounts_prepared ? 'Yes' : 'No' }}</span></div>
                      <div v-if="accountantReference.accounts_year_end"><span
                          class="text-green-700 font-medium">Accounts Year
                          End:</span> <span class="text-green-900">{{
                            formatDate(accountantReference.accounts_year_end) }}</span></div>
                      <div v-if="accountantReference.any_outstanding_tax_liabilities !== undefined"><span
                          class="text-green-700 font-medium">Tax Liabilities:</span> <span class="text-green-900">{{
                            accountantReference.any_outstanding_tax_liabilities ? 'Yes' : 'No'
                          }}</span></div>
                      <div v-if="accountantReference.business_financially_stable !== undefined"><span
                          class="text-green-700 font-medium">Financially Stable:</span> <span
                          class="text-green-900 font-semibold">{{ accountantReference.business_financially_stable ?
                            'Yes' : 'No' }}</span></div>
                    </div>

                    <div v-if="accountantReference.tax_liabilities_details"
                      class="mt-3 p-3 bg-white rounded border border-green-200">
                      <span class="text-green-700 font-medium text-sm">Tax Liabilities Details:</span>
                      <p class="text-green-900 text-sm mt-1">{{ accountantReference.tax_liabilities_details }}</p>
                    </div>
                  </div>

                  <!-- Assessment -->
                  <div class="pt-3 border-t border-green-200">
                    <h5 class="text-sm font-semibold text-green-800 mb-2">Assessment</h5>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div v-if="accountantReference.accountant_confirms_income !== undefined"><span
                          class="text-green-700 font-medium">Income Confirmed:</span> <span
                          class="text-green-900 font-semibold">{{ accountantReference.accountant_confirms_income ?
                            'Yes' : 'No' }}</span></div>
                      <div v-if="accountantReference.would_recommend !== undefined"><span
                          class="text-green-700 font-medium">Would Recommend:</span> <span
                          class="text-green-900 font-semibold">{{ accountantReference.would_recommend ? 'Yes' : 'No'
                          }}</span></div>
                    </div>

                    <div v-if="accountantReference.additional_comments || accountantReference.recommendation_comments"
                      class="mt-3 p-3 bg-white rounded border border-green-200">
                      <span class="text-green-700 font-medium text-sm">Comments:</span>
                      <p class="text-green-900 text-sm mt-1">{{ accountantReference.additional_comments ||
                        accountantReference.recommendation_comments }}</p>
                    </div>
                  </div>

                  <!-- Accountant Signature -->
                  <div v-if="accountantReference.signature" class="pt-3 border-t border-green-200">
                    <h5 class="text-sm font-semibold text-green-800 mb-2">Signature</h5>
                    <div class="inline-block bg-white border border-green-200 rounded-md p-2">
                      <img :src="accountantReference.signature" alt="Accountant signature"
                        class="max-w-xs sm:max-w-md h-auto" />
                    </div>
                  </div>
                </div>
              </div>

              <!-- Accountant vs Tenant Comparison -->
              <div v-if="accountantComparisonTable.length" class="bg-white border rounded-lg p-4 mt-4">
                <div class="flex items-center justify-between mb-3">
                  <h4 class="font-semibold text-gray-900">Accountant Reference vs Tenant Declaration</h4>
                  <span class="text-xs text-gray-500" v-if="accountantComparisonHasMismatch">
                    Differences detected—document rationale below.
                  </span>
                </div>
                <div class="overflow-x-auto">
                  <table class="min-w-full divide-y divide-gray-200 text-sm">
                    <thead class="bg-gray-50">
                      <tr>
                        <th class="px-4 py-2 text-left font-medium text-gray-600 uppercase tracking-wide">Field</th>
                        <th class="px-4 py-2 text-left font-medium text-gray-600 uppercase tracking-wide">Tenant Provided</th>
                        <th class="px-4 py-2 text-left font-medium text-gray-600 uppercase tracking-wide">Accountant Confirmed</th>
                        <th class="px-4 py-2 text-center font-medium text-gray-600 uppercase tracking-wide">Status</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100">
                      <tr v-for="row in accountantComparisonTable" :key="row.key" :class="row.status === 'mismatch'
                        ? 'bg-red-50'
                        : row.status === 'unknown'
                          ? 'bg-gray-50'
                          : ''">
                        <td class="px-4 py-2 font-medium text-gray-900">{{ row.label }}</td>
                        <td class="px-4 py-2 text-gray-900">{{ row.tenant }}</td>
                        <td class="px-4 py-2 text-gray-900">{{ row.accountant }}</td>
                        <td class="px-4 py-2 text-center">
                          <span :class="[
                            'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                            comparisonBadgeClass(row.status)
                          ]">
                            {{ comparisonStatusLabel(row.status) }}
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p v-if="accountantComparisonHasMismatch"
                  class="mt-3 text-sm text-yellow-800 bg-yellow-50 border border-yellow-200 rounded-md p-3">
                  Please add notes in this step explaining how you resolved these differences before proceeding.
                </p>
              </div>
            </div>

            <!-- Savings, Pensions or Investments Details -->
            <div v-if="reference?.income_savings_pension_investments" class="border-t pt-6 mt-6">
              <h5 class="text-md font-semibold text-gray-900 mb-4">Savings, Pensions or Investments</h5>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p class="text-gray-500 font-medium">Total Savings Amount</p>
                  <p class="mt-1 text-gray-900">{{ reference?.savings_amount ?
                    `£${parseFloat(reference.savings_amount || '0').toLocaleString('en-GB')}` : 'Not provided' }}</p>
                </div>
              </div>

              <!-- Proof of Funds Document -->
              <div class="mt-4">
                <p class="block text-sm font-medium text-gray-700 mb-2">Proof of Funds</p>
                <div v-if="reference?.proof_of_funds_path"
                  class="flex items-center justify-between bg-gray-50 px-4 py-3 rounded-lg">
                  <div class="flex items-center">
                    <svg class="w-5 h-5 text-gray-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <span class="text-sm text-gray-900">Proof of Funds Document</span>
                  </div>
                  <div class="flex gap-2">
                    <button type="button" @click="previewProofOfFunds(reference.proof_of_funds_path)"
                      class="px-3 py-1 text-xs sm:text-sm font-medium text-primary bg-white border border-primary hover:bg-primary/5 rounded-md">
                      Preview
                    </button>
                  </div>
                </div>
                <div v-else class="bg-gray-50 rounded-lg p-4">
                  <p class="text-gray-500 text-center text-sm mb-3">Proof of funds not uploaded yet</p>
                  <div class="flex justify-center gap-2">
                    <label class="px-3 py-1.5 text-xs font-medium text-white bg-primary hover:bg-primary/90 rounded-md cursor-pointer">
                      <input type="file" class="hidden" accept=".pdf,.jpg,.jpeg,.png" @change="(e) => handleStaffUpload(e, 'proof_of_funds')">
                      Upload
                    </label>
                    <button type="button" @click="openRequestDocumentModal('proof_of_funds')"
                      class="px-3 py-1.5 text-xs font-medium text-primary bg-white border border-primary hover:bg-primary/5 rounded-md">
                      Request from Tenant
                    </button>
                  </div>
                </div>

                <!-- Embedded proof of funds viewer -->
                <div v-if="proofOfFundsPreviewUrl" class="mt-4 border rounded-lg overflow-hidden bg-gray-50">
                  <div class="flex items-center justify-between px-4 py-2 border-b bg-white">
                    <p class="text-sm font-medium text-gray-700">
                      Proof of funds preview
                    </p>
                    <button type="button" class="text-xs text-gray-500 hover:text-gray-700"
                      @click="clearProofOfFundsPreview">
                      Close preview
                    </button>
                  </div>
                  <div class="h-[480px]">
                    <iframe :src="proofOfFundsPreviewUrl" class="w-full h-full" frameborder="0"></iframe>
                  </div>
                </div>
              </div>
            </div>

            <!-- Benefits Details -->
            <div v-if="reference?.income_benefits" class="border-t pt-6 mt-6">
              <h5 class="text-md font-semibold text-gray-900 mb-4">Benefits</h5>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div v-if="reference?.benefits_annual_amount">
                  <p class="text-gray-500 font-medium">Annual Benefits Amount</p>
                  <p class="mt-1 text-gray-900">£{{ parseFloat(reference.benefits_annual_amount ||
                    '0').toLocaleString('en-GB') }}</p>
                </div>
                <div v-if="reference?.benefits_type">
                  <p class="text-gray-500 font-medium">Benefits Type</p>
                  <p class="mt-1 text-gray-900 capitalize">{{ reference.benefits_type }}</p>
                </div>
              </div>
            </div>

            <!-- Additional Income -->
            <div v-if="reference?.has_additional_income || reference?.additional_income_amount"
              class="border-t pt-6 mt-6">
              <h5 class="text-md font-semibold text-gray-900 mb-4">Additional Income</h5>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div v-if="reference?.additional_income_source">
                  <p class="text-gray-500 font-medium">Source</p>
                  <p class="mt-1 text-gray-900">{{ reference.additional_income_source }}</p>
                </div>
                <div v-if="reference?.additional_income_amount">
                  <p class="text-gray-500 font-medium">Amount</p>
                  <p class="mt-1 text-gray-900">£{{ parseFloat(reference.additional_income_amount ||
                    '0').toLocaleString('en-GB') }}</p>
                </div>
                <div v-if="reference?.additional_income_frequency">
                  <p class="text-gray-500 font-medium">Frequency</p>
                  <p class="mt-1 text-gray-900 capitalize">{{ reference.additional_income_frequency }}</p>
                </div>
              </div>

              <!-- Proof of Additional Income Document -->
              <div class="mt-4">
                <p class="block text-sm font-medium text-gray-700 mb-2">Proof of Additional Income</p>
                <div v-if="reference?.proof_of_additional_income_path">
                  <div class="flex items-center justify-between bg-gray-50 px-4 py-3 rounded-lg">
                    <div class="flex items-center">
                      <svg class="w-5 h-5 text-gray-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      <span class="text-sm text-gray-900">Proof of Additional Income Document</span>
                    </div>
                    <div class="flex gap-2">
                      <button type="button"
                        @click="previewProofOfAdditionalIncome(reference.proof_of_additional_income_path)"
                        class="px-3 py-1 text-xs sm:text-sm font-medium text-primary bg-white border border-primary hover:bg-primary/5 rounded-md">
                        Preview
                      </button>
                    </div>
                  </div>

                  <!-- Embedded proof of additional income viewer -->
                  <div v-if="proofOfAdditionalIncomePreviewUrl" class="mt-4 border rounded-lg overflow-hidden bg-gray-50">
                    <div class="flex items-center justify-between px-4 py-2 border-b bg-white">
                      <p class="text-sm font-medium text-gray-700">
                        Proof of additional income preview
                      </p>
                      <button type="button" class="text-xs text-gray-500 hover:text-gray-700"
                        @click="clearProofOfAdditionalIncomePreview">
                        Close preview
                      </button>
                    </div>
                    <div class="h-[480px]">
                      <iframe :src="proofOfAdditionalIncomePreviewUrl" class="w-full h-full" frameborder="0"></iframe>
                    </div>
                  </div>
                </div>
                <div v-else class="bg-gray-50 rounded-lg p-4">
                  <p class="text-gray-500 text-center text-sm mb-3">Proof of additional income not uploaded yet</p>
                  <div class="flex justify-center gap-2">
                    <label class="px-3 py-1.5 text-xs font-medium text-white bg-primary hover:bg-primary/90 rounded-md cursor-pointer">
                      <input type="file" class="hidden" accept=".pdf,.jpg,.jpeg,.png" @change="(e) => handleStaffUpload(e, 'proof_of_additional_income')">
                      Upload
                    </label>
                    <button type="button" @click="openRequestDocumentModal('proof_of_additional_income')"
                      class="px-3 py-1.5 text-xs font-medium text-primary bg-white border border-primary hover:bg-primary/5 rounded-md">
                      Request from Tenant
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Employer vs Tenant Comparison -->
            <div v-if="employmentComparisonTable.length" class="bg-white border rounded-lg p-4">
              <div class="flex items-center justify-between mb-3">
                <h4 class="font-semibold text-gray-900">Employer Reference vs Tenant Declaration</h4>
                <span class="text-xs text-gray-500" v-if="employmentComparisonHasMismatch">
                  Differences detected—document rationale below.
                </span>
              </div>
              <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200 text-sm">
                  <thead class="bg-gray-50">
                    <tr>
                      <th class="px-4 py-2 text-left font-medium text-gray-600 uppercase tracking-wide">Field</th>
                      <th class="px-4 py-2 text-left font-medium text-gray-600 uppercase tracking-wide">Tenant Provided
                      </th>
                      <th class="px-4 py-2 text-left font-medium text-gray-600 uppercase tracking-wide">Employer
                        Confirmed</th>
                      <th class="px-4 py-2 text-center font-medium text-gray-600 uppercase tracking-wide">Status</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-100">
                    <tr v-for="row in employmentComparisonTable" :key="row.key" :class="row.status === 'mismatch'
                      ? 'bg-red-50'
                      : row.status === 'unknown'
                        ? 'bg-gray-50'
                        : ''">
                      <td class="px-4 py-2 font-medium text-gray-900">{{ row.label }}</td>
                      <td class="px-4 py-2 text-gray-900">{{ row.tenant }}</td>
                      <td class="px-4 py-2 text-gray-900">{{ row.employer }}</td>
                      <td class="px-4 py-2 text-center">
                        <span :class="[
                          'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                          comparisonBadgeClass(row.status)
                        ]">
                          {{ comparisonStatusLabel(row.status) }}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p v-if="employmentComparisonHasMismatch"
                class="mt-3 text-sm text-yellow-800 bg-yellow-50 border border-yellow-200 rounded-md p-3">
                Please add notes in this step explaining how you resolved these differences before proceeding.
              </p>
            </div>

            <!-- Employer Signature -->
            <div v-if="employerReference && (employerReference.signature || employerReference.signature_name)"
              class="bg-white border rounded-lg p-4">
              <h4 class="font-semibold text-gray-900 mb-3">Employer Declaration & Signature</h4>
              <div class="space-y-2">
                <p v-if="employerReference.signature_name" class="text-sm text-gray-700 font-medium">
                  {{ employerReference.signature_name }}
                </p>
                <div v-if="employerReference.signature"
                  class="inline-block bg-gray-50 border border-gray-200 rounded-md p-2">
                  <img :src="employerReference.signature" alt="Employer signature"
                    class="max-w-xs sm:max-w-md h-auto" />
                </div>
                <p v-if="employerReference.date" class="text-xs text-gray-500">
                  Signed on {{ formatDate(employerReference.date, 'Not provided') }}
                </p>
              </div>
            </div>

            <!-- Verification Checks -->
            <div v-if="!reference?.income_student && !reference?.income_unemployed"
              class="bg-white border rounded-lg p-4">
              <h4 class="font-semibold text-gray-900 mb-3">Verification Checks</h4>
              <div class="space-y-3">
                <div v-if="reference?.income_employment || reference?.income_regular_employment"
                  class="flex items-start justify-between p-3 bg-gray-50 rounded">
                  <div class="flex-1">
                    <p class="text-sm font-medium text-gray-700">Is the employer email genuine? (Business domain check)
                    </p>
                    <p v-if="reference?.employer_ref_email" class="text-sm  text-gray-500 mt-1">{{
                      (reference.employer_ref_email?.includes('@') ? reference.employer_ref_email.split('@')[1] : 'Not provided')
                      }}</p>
                  </div>
                  <div class="flex gap-2 ml-4">
                    <button @click="toggleCheck('employerEmailGenuine', true)" :class="['px-3 py-1 text-xs font-medium rounded transition-all',
                      getCheckValue('employerEmailGenuine') === true
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-green-100']">
                      Pass
                    </button>
                    <button @click="toggleCheck('employerEmailGenuine', false)" :class="['px-3 py-1 text-xs font-medium rounded transition-all',
                      getCheckValue('employerEmailGenuine') === false
                        ? 'bg-red-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-red-100']">
                      Fail
                    </button>
                  </div>
                </div>

                <div v-if="reference?.income_employment || reference?.income_regular_employment"
                  class="flex items-start justify-between p-3 bg-gray-50 rounded">
                  <div class="flex-1">
                    <p class="text-sm font-medium text-gray-700">Is the business actively trading?<a
                        class="text-blue-500 text-xs underline cursor-pointer ml-2" rel="noopener noreferrer"
                        :href="`https://find-and-update.company-information.service.gov.uk/search?q=${reference.employment_company_name}`"
                        target="_blank">
                        verify status
                      </a></p>
                    <p v-if="reference?.employment_company_name" class="text-xs text-gray-500 mt-1">{{
                      reference.employment_company_name }}</p>
                  </div>
                  <div class="flex gap-2 ml-4">
                    <button @click="toggleCheck('businessTrading', true)" :class="[
                      'px-3 py-1 text-xs font-medium rounded transition-all',
                      getCheckValue('businessTrading') === true
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-green-100'
                    ]">
                      Pass
                    </button>
                    <button @click="toggleCheck('businessTrading', false)" :class="[
                      'px-3 py-1 text-xs font-medium rounded transition-all',
                      getCheckValue('businessTrading') === false
                        ? 'bg-red-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-red-100'
                    ]">
                      Fail
                    </button>
                  </div>
                </div>

                <div class="flex items-start justify-between p-3 bg-gray-50 rounded">
                  <div class="flex-1">
                    <p class="text-sm font-medium text-gray-700">Income sufficient for rent affordability?</p>
                    <p v-if="reference?.rent_share" class="text-xs text-gray-500 mt-1">
                      Rent share: £{{ reference.rent_share }}
                      <span v-if="reference.monthly_rent"> (of £{{ reference.monthly_rent }} total)</span>
                    </p>
                    <p v-else-if="reference?.monthly_rent" class="text-xs text-gray-500 mt-1">Monthly rent: £{{ reference.monthly_rent }}</p>
                  </div>
                  <div class="flex gap-2 ml-4">
                    <button @click="toggleCheck('affordability', true)" :class="[
                      'px-3 py-1 text-xs font-medium rounded transition-all',
                      getCheckValue('affordability') === true
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-green-100'
                    ]">
                      Pass
                    </button>
                    <button @click="toggleCheck('affordability', false)" :class="[
                      'px-3 py-1 text-xs font-medium rounded transition-all',
                      getCheckValue('affordability') === false
                        ? 'bg-red-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-red-100'
                    ]">
                      Fail
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Evidence Source Selection -->
            <div v-if="!reference?.income_student && !reference?.income_unemployed">
              <label class="block text-sm font-medium text-gray-700 mb-2">Evidence Sources Used</label>
              <div class="grid grid-cols-2 gap-3">
                <label v-for="source in evidenceSourceOptions.INCOME_AFFORDABILITY" :key="source.evidence_type"
                  class="flex items-center p-3 border rounded-md cursor-pointer hover:bg-gray-50"
                  :class="steps[2]!.evidence_sources.includes(source.evidence_type) ? 'border-primary bg-primary/5' : 'border-gray-300'">
                  <input type="checkbox" :value="source.evidence_type" v-model="steps[2]!.evidence_sources"
                    class="mr-3 h-4 w-4 text-primary focus:ring-primary" />
                  <span class="text-sm">{{ source.display_label }}</span>
                </label>
              </div>
            </div>

            <!-- Notes -->
            <div>
              <p class="text-xs text-gray-500 mb-1">External Notes - these notes will be shown to the reference creator</p>
              <label class="block text-sm font-medium text-gray-700 mb-2">Notes</label>
              <textarea v-model="steps[2]!.notes" rows="3"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                placeholder="Add notes about income verification, affordability calculations, guarantor rationale, etc."></textarea>
            </div>

            <div v-if="!reference?.income_student && !reference?.income_unemployed" class="mx-auto bg-white">

              <h2 class="text-2xl font-bold">Income Breakdown</h2>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-800">

                <div>
                  <p class="font-medium">Salary (£)</p>
                  <p class="text-lg text-gray-600">£{{ annualSalary || 0 }}</p>
                </div>

                <div>
                  <p class="font-medium">Self-employed (£)</p>
                  <p class="text-lg text-gray-600">£{{ parseFloat(accountantReference?.annual_profit || '0') }}</p>
                </div>

                <div>
                  <p class="font-medium">Benefits (£)</p>
                  <p class="text-lg text-gray-600">£{{ parseFloat(reference.benefits_annual_amount ||
                    '0') }}</p>
                </div>

                <div>
                  <p class="font-medium">Savings / Pension / Investment (£)</p>
                  <p class="text-lg text-gray-600">£{{ parseFloat(reference.savings_amount || '0') }}</p>
                </div>

                <div>
                  <p class="font-medium">Additional Income (£)</p>
                  <p class="text-lg text-gray-600">£{{ parseFloat(reference.additional_income_amount ||
                    '0') }}</p>
                </div>

              </div>

              <!-- Gross Total -->
              <div class="p-4 bg-gray-100 rounded mt-3">
                <p class="text-lg font-semibold">
                  Gross Total:
                  <span class="text-blue-600">£{{ annualSalary + parseFloat(accountantReference?.annual_profit || '0') +
                    parseFloat(reference.benefits_annual_amount || '0') + parseFloat(reference.savings_amount || '0') +
                    parseFloat(reference.additional_income_amount || '0')}}</span>
                </p>
                <p class="text-lg font-semibold">
                  Max Affordability (Gross ÷ 30):
                  <span class="text-green-600">£{{ (annualSalary + parseFloat(accountantReference?.annual_profit || '0')
                    +
                    parseFloat(reference.benefits_annual_amount || '0') + parseFloat(reference.savings_amount || '0') +
                    parseFloat(reference.additional_income_amount || '0'))/30 }} pcm</span>
                </p>
                <p v-if="reference.rent_share" class="text-lg font-semibold">
                  Rent Share:
                  <span class="text-blue-600">£{{ reference.rent_share }}</span>
                  <span v-if="reference.monthly_rent" class="text-sm text-gray-600"> (of £{{ reference.monthly_rent }} total)</span>
                  <span>/month</span>
                </p>
                <p v-else-if="reference.monthly_rent" class="text-lg font-semibold">
                  Monthly Rent:
                  <span class="text-blue-600">£{{ reference.monthly_rent }}/month</span>
                </p>
              </div>


            </div>

            <!-- Overall Result: Pass / Fail / Guarantor Needed -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Overall Result</label>
              <p class="text-sm text-gray-600 mb-3">
                Based on all income, employment, benefits and savings information above, record whether the tenant
                passes affordability on their own, fails, or requires a guarantor.
              </p>
              <div class="flex flex-col sm:flex-row gap-3">
                <button @click="steps[2]!.overall_pass = true; steps[2]!.status = ''" :disabled="!canMakeStep2Decision"
                  :class="[
                    'flex-1 py-3 px-4 rounded-md font-medium transition-all',
                    steps[2]!.overall_pass === true && steps[2]!.status !== 'GUARANTOR_NEEDED'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-green-50',
                    !canMakeStep2Decision ? 'opacity-50 cursor-not-allowed' : ''
                  ]">
                  Pass - Affordability supersede the rent share
                </button>
                <button @click="steps[2]!.overall_pass = false; steps[2]!.status = ''" :disabled="!canMakeStep2Decision"
                  :class="[
                    'flex-1 py-3 px-4 rounded-md font-medium transition-all',
                    steps[2]!.overall_pass === false && steps[2]!.status !== 'GUARANTOR_NEEDED'
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-red-50',
                    !canMakeStep2Decision ? 'opacity-50 cursor-not-allowed' : ''
                  ]">
                  Fail - Affordability not met
                </button>
                <button
                  v-if="(reference?.income_student || reference?.income_unemployed) && !guarantorReference && !steps[2]!.overall_pass"
                  @click="steps[2]!.overall_pass = null; steps[2]!.status = 'GUARANTOR_NEEDED'"
                  :disabled="!canMakeStep2Decision" :class="[
                    'flex-1 py-3 px-4 rounded-md font-medium transition-all',
                    steps[2]!.status === 'GUARANTOR_NEEDED'
                      ? 'bg-amber-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-amber-50',
                    !canMakeStep2Decision ? 'opacity-50 cursor-not-allowed' : ''
                  ]">
                  Guarantor Needed
                </button>
              </div>
              <p v-if="!canMakeStep2Decision" class="mt-2 text-sm text-gray-500">
                Please complete all verification checks above before making a final decision.
              </p>
            </div>
          </div>
        </div>

        <!-- Step 4: Residential -->
        <div v-if="currentStep === 4">
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-xl font-bold text-gray-900">Step 4: Residential Verification</h3>
            <span
              class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-800 border border-indigo-100">
              Residential Score: {{ domainScores.residential ?? '—' }}
            </span>
          </div>
          <p class="text-gray-600 mb-6">Verify residential history and landlord/letting agent references.</p>

          <!-- Case 1: Tenant living with family -->
          <div v-if="reference?.reference_type === 'living_with_family'"
            class="bg-blue-50 border-2 border-blue-300 rounded-lg p-6 mb-6">
            <div class="flex items-start gap-4">
              <div class="flex-shrink-0">
                <svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h4 class="text-lg font-semibold text-blue-900 mb-1">Tenant Living with Family / Friends</h4>
                <p class="text-sm text-blue-800">
                  The tenant has declared that they are currently living with family or friends. No previous landlord or
                  letting agent reference is required for this step.
                </p>
              </div>
            </div>
          </div>

          <!-- Case 2: Standard residential references -->
          <div class="space-y-6">
            <!-- Current Address (refined UI) -->
            <div v-if="reference?.reference_type !== 'living_with_family'"
              class="bg-white rounded-lg shadow p-4 space-y-4">
              <div class="flex items-center justify-between">
                <h4 class="font-semibold text-gray-900">Current Address</h4>
                <span
                  class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                  Primary residence
                </span>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div class="md:col-span-2">
                  <p class="text-gray-500 font-medium">Address</p>
                  <p class="mt-1 text-gray-900">
                    {{ reference?.current_address_line1 || 'Not provided' }}
                    <span v-if="reference?.current_address_line2">, {{ reference.current_address_line2 }}</span>
                  </p>
                </div>
                <div>
                  <p class="text-gray-500 font-medium">City</p>
                  <p class="mt-1 text-gray-900">{{ reference?.current_city || 'Not provided' }}</p>
                </div>
                <div>
                  <p class="text-gray-500 font-medium">Postcode</p>
                  <p class="mt-1 text-gray-900">{{ reference?.current_postcode || 'Not provided' }}</p>
                </div>
                <div>
                  <p class="text-gray-500 font-medium">Country</p>
                  <p class="mt-1 text-gray-900">{{ reference?.current_country || 'Not provided' }}</p>
                </div>
                <div>
                  <p class="text-gray-500 font-medium">Time at Address</p>
                  <p class="mt-1 text-gray-900">
                    <span v-if="reference?.time_at_address_years || reference?.time_at_address_months">
                      {{ reference.time_at_address_years || 0 }} year(s), {{ reference.time_at_address_months || 0 }}
                      month(s)
                    </span>
                    <span v-else>Not provided</span>
                  </p>
                </div>
              </div>

              <!-- Proof of Address Document Preview -->
              <div class="pt-3 border-t">
                <p class="text-sm font-medium text-gray-700 mb-2">Proof of Address Document</p>
                <div v-if="reference?.proof_of_address_path">
                  <div class="mb-2 flex items-center justify-between">
                    <div class="flex items-center">
                      <svg class="w-5 h-5 text-gray-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      <span class="text-sm text-gray-900">Document Preview</span>
                    </div>
                    <a v-if="proofOfAddressBlobUrl" :href="proofOfAddressBlobUrl" target="_blank"
                      class="text-sm text-orange-600 hover:text-orange-700 font-medium">
                      Open in new tab
                    </a>
                  </div>
                  <div class="h-96 border rounded-md overflow-hidden bg-gray-50 flex items-center justify-center">
                    <template v-if="proofOfAddressBlobUrl">
                      <!-- PDF Viewer -->
                      <iframe v-if="proofOfAddressIsPdf"
                        :src="proofOfAddressBlobUrl"
                        class="w-full h-full"
                        style="min-height: 384px;"
                        frameborder="0"
                      ></iframe>
                      <!-- Image Viewer -->
                      <img v-else :src="proofOfAddressBlobUrl" class="max-w-full max-h-full object-contain" alt="Proof of Address" />
                    </template>
                    <div v-else class="flex items-center justify-center h-full text-xs text-gray-500">
                      Loading document preview...
                    </div>
                  </div>
                </div>
                <div v-else class="bg-gray-50 border border-dashed border-gray-200 rounded-md p-4">
                  <p class="text-sm text-gray-500 text-center mb-3">Proof of address document not provided.</p>
                  <div class="flex justify-center gap-2">
                    <label class="px-3 py-1.5 text-xs font-medium text-white bg-primary hover:bg-primary/90 rounded-md cursor-pointer">
                      <input type="file" class="hidden" accept=".pdf,.jpg,.jpeg,.png" @change="(e) => handleStaffUpload(e, 'proof_of_address')">
                      Upload
                    </label>
                    <button type="button" @click="openRequestDocumentModal('proof_of_address')"
                      class="px-3 py-1.5 text-xs font-medium text-primary bg-white border border-primary hover:bg-primary/5 rounded-md">
                      Request from Tenant
                    </button>
                  </div>
                </div>
              </div>

              <!-- Previous Addresses History -->
              <div v-if="previousAddresses && previousAddresses.length > 0" class="pt-6 border-t mt-6">
                <h4 class="text-md font-semibold text-gray-900 mb-4">Previous Address History</h4>
                <p class="text-xs text-gray-500 mb-4">Previous addresses provided to meet 3-year address history
                  requirement</p>

                <div v-for="(address, index) in previousAddresses" :key="address.id || index"
                  class="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h5 class="text-sm font-semibold text-gray-900 mb-3">Previous Address {{ index + 1 }}</h5>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div class="md:col-span-2">
                      <p class="text-gray-500 font-medium">Address</p>
                      <p class="mt-1 text-gray-900">
                        {{ address.address_line1 || 'Not provided' }}
                        <span v-if="address.address_line2">, {{ address.address_line2 }}</span>
                      </p>
                    </div>
                    <div>
                      <p class="text-gray-500 font-medium">City</p>
                      <p class="mt-1 text-gray-900">{{ address.city || 'Not provided' }}</p>
                    </div>
                    <div>
                      <p class="text-gray-500 font-medium">Postcode</p>
                      <p class="mt-1 text-gray-900">{{ address.postcode || 'Not provided' }}</p>
                    </div>
                    <div v-if="address.country">
                      <p class="text-gray-500 font-medium">Country</p>
                      <p class="mt-1 text-gray-900">{{ address.country }}</p>
                    </div>
                    <div
                      v-if="address.time_at_address_years !== undefined || address.time_at_address_months !== undefined">
                      <p class="text-gray-500 font-medium">Time at Address</p>
                      <p class="mt-1 text-gray-900">
                        {{ address.time_at_address_years || 0 }} year(s), {{ address.time_at_address_months || 0 }}
                        month(s)
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Previous Landlord / Agent Information (summary) -->
            <div v-if="(landlordReference || agentReference) && reference?.reference_type !== 'living_with_family'"
              class="bg-white rounded-lg shadow p-4 space-y-4">
              <div class="flex items-start justify-between">
                <div>
                  <h4 class="text-md font-semibold text-gray-900 mb-1">Previous {{ landlordReference ? 'Landlord' :
                    'Letting Agent' }} Information</h4>
                  <p class="text-xs text-gray-600">
                    Details of the previous tenancy as provided in the application and confirmed by the
                    {{ landlordReference ? 'landlord' : 'agent' }}.
                  </p>
                </div>
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
                  :class="landlordReference ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800'">
                  {{ landlordReference ? 'Landlord Reference' : 'Letting Agent Reference' }}
                </span>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p class="text-gray-500 font-medium">{{ landlordReference ? 'Landlord Name' : 'Agent Name' }}</p>
                  <p class="mt-1 text-gray-900">
                    {{ landlordReference?.landlord_name || agentReference?.agent_name ||
                      reference?.previous_landlord_name || 'Not provided yet' }}
                  </p>
                </div>
                <div>
                  <p class="text-gray-500 font-medium">{{ landlordReference ? 'Email' : 'Agent Email' }}</p>
                  <p class="mt-1 text-gray-900">
                    {{ landlordReference?.landlord_email || agentReference?.agent_email ||
                      reference?.previous_landlord_email || 'Not provided yet' }}
                  </p>
                </div>
                <div>
                  <p class="text-gray-500 font-medium">Phone</p>
                  <p class="mt-1 text-gray-900">
                    {{ landlordReference?.landlord_phone || agentReference?.agent_phone ||
                      reference?.previous_landlord_phone || 'Not provided yet' }}
                  </p>
                </div>
                <div>
                  <p class="text-gray-500 font-medium">Previous Monthly Rent</p>
                  <p class="mt-1 text-gray-900">
                    <span v-if="reference?.previous_monthly_rent">£{{ reference.previous_monthly_rent }}/month</span>
                    <span v-else>Not provided yet</span>
                  </p>
                </div>
                <div class="md:col-span-2">
                  <p class="text-gray-500 font-medium">Previous Address</p>
                  <p class="mt-1 text-gray-900">
                    {{ reference?.previous_rental_address_line1 || 'Not provided yet' }}
                    <span v-if="reference?.previous_rental_address_line2">, {{ reference.previous_rental_address_line2
                      }}</span>
                  </p>
                  <p v-if="reference?.previous_rental_city || reference?.previous_rental_postcode"
                    class="mt-1 text-gray-900">
                    {{ reference.previous_rental_city || '' }}<span
                      v-if="reference.previous_rental_city && reference.previous_rental_postcode">, </span>{{
                        reference.previous_rental_postcode || '' }}
                  </p>
                </div>
                <div>
                  <p class="text-gray-500 font-medium">Tenancy Period (Application)</p>
                  <p class="mt-1 text-gray-900">
                    <span v-if="reference?.previous_tenancy_start_date || reference?.previous_tenancy_end_date">
                      {{ formatDate(reference.previous_tenancy_start_date, 'N/A') }}
                      {{ ' to ' }}
                      {{ reference.previous_tenancy_still_in_progress ? 'Present' :
                        formatDate(reference.previous_tenancy_end_date, 'Still in tenancy') }}
                    </span>
                    <span v-else>Not provided yet</span>
                  </p>
                </div>
                <div>
                  <p class="text-gray-500 font-medium">Tenancy Period (Reference)</p>
                  <p class="mt-1 text-gray-900" v-if="landlordReference">
                    {{ formatDate(landlordReference.tenancy_start_date, 'N/A') }}
                    {{ ' to ' }}
                    {{ landlordReference.tenancy_still_in_progress ? 'Still in tenancy' :
                      formatDate(landlordReference.tenancy_end_date, 'N/A') }}
                  </p>
                  <p class="mt-1 text-gray-900" v-else-if="agentReference">
                    {{ formatDate(agentReference.tenancy_start_date, 'N/A') }}
                    {{ ' to ' }}
                    {{ agentReference.tenancy_still_in_progress ? 'Still in tenancy' :
                      formatDate(agentReference.tenancy_end_date, 'N/A') }}
                  </p>
                  <p class="mt-1 text-gray-900" v-else>Not provided yet</p>
                </div>
              </div>
            </div>

            <!-- Landlord/Agent Reference Response (detailed) -->
            <div v-if="(landlordReference || agentReference) && reference?.reference_type !== 'living_with_family'"
              class="bg-white border rounded-lg p-4">
              <div class="flex items-center justify-between mb-3">
                <h4 class="font-semibold text-gray-900">
                  {{ landlordReference ? 'Landlord' : 'Agent' }} Reference Response
                </h4>
                <span v-if="landlordReference?.address_correct" :class="[
                  'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold',
                  landlordReference.address_correct === 'yes'
                    ? 'bg-green-100 text-green-800 border border-green-200'
                    : 'bg-red-100 text-red-800 border border-red-200'
                ]">
                  Address Verified
                </span>
              </div>
              <div class="space-y-4 text-sm">
                <div v-if="landlordReference">
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <p class="text-xs text-gray-500 uppercase tracking-wide">Rent Paid On Time</p>
                      <p class="font-medium capitalize text-gray-900">
                        {{ landlordReference.rent_paid_on_time || 'Not provided' }}
                      </p>
                    </div>
                    <div>
                      <p class="text-xs text-gray-500 uppercase tracking-wide">Good Tenant</p>
                      <p class="font-medium capitalize text-gray-900">
                        {{ landlordReference.good_tenant || 'Not provided' }}
                      </p>
                    </div>
                    <div>
                      <p class="text-xs text-gray-500 uppercase tracking-wide">Would Rent Again</p>
                      <p class="font-medium capitalize text-gray-900">
                        {{ landlordReference.would_rent_again || 'Not provided' }}
                      </p>
                    </div>
                    <div v-if="landlordReference.monthly_rent">
                      <p class="text-xs text-gray-500 uppercase tracking-wide">Monthly Rent (Confirmed)</p>
                      <p class="font-medium text-gray-900">£{{ landlordReference.monthly_rent }}</p>
                    </div>
                  </div>
                  <div v-if="landlordReference.additional_comments" class="mt-2">
                    <p class="text-xs text-gray-500 uppercase tracking-wide">Additional Comments</p>
                    <p class="text-sm text-gray-900 whitespace-pre-line">{{ landlordReference.additional_comments }}</p>
                  </div>
                  <div v-if="landlordReference.signature" class="mt-3">
                    <p class="text-xs text-gray-500 uppercase tracking-wide mb-1">Signature</p>
                    <img :src="landlordReference.signature" alt="Landlord signature"
                      class="h-20 object-contain border rounded bg-white p-2" />
                  </div>
                  <div v-if="landlordReference.submitted_ip_address || landlordReference.submitted_geolocation"
                    class="mt-3 text-xs text-gray-500 space-y-1">
                    <p v-if="landlordReference.submitted_ip_address">IP: {{ landlordReference.submitted_ip_address }}
                    </p>
                    <p v-if="landlordReference.submitted_geolocation" class="flex items-center gap-2">
                      Location: {{ formatGeolocationText(landlordReference.submitted_geolocation) }}
                      <button type="button" class="text-primary underline"
                        @click="openGeolocationMap(landlordReference.submitted_geolocation)">
                        Map
                      </button>
                    </p>
                  </div>
                </div>

                <div v-if="agentReference">
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <p class="text-xs text-gray-500 uppercase tracking-wide">Rent Paid On Time</p>
                      <p class="font-medium text-gray-900">
                        {{ formatBooleanDisplay(agentReference.rent_paid_on_time) }}
                      </p>
                    </div>
                    <div>
                      <p class="text-xs text-gray-500 uppercase tracking-wide">Good Tenant</p>
                      <p class="font-medium text-gray-900">
                        {{ formatBooleanDisplay(agentReference.good_tenant) }}
                      </p>
                    </div>
                    <div>
                      <p class="text-xs text-gray-500 uppercase tracking-wide">Would Rent Again</p>
                      <p class="font-medium text-gray-900">
                        {{ formatBooleanDisplay(agentReference.would_rent_again) }}
                      </p>
                    </div>
                  </div>
                  <div v-if="agentReference.additional_comments" class="mt-2">
                    <p class="text-xs text-gray-500 uppercase tracking-wide">Additional Comments</p>
                    <p class="text-sm text-gray-900 whitespace-pre-line">{{ agentReference.additional_comments }}</p>
                  </div>
                  <div v-if="agentReference.signature" class="mt-3">
                    <p class="text-xs text-gray-500 uppercase tracking-wide mb-1">Signature</p>
                    <img :src="agentReference.signature" alt="Agent signature"
                      class="h-20 object-contain border rounded bg-white p-2" />
                  </div>
                  <div v-if="agentReference.submitted_ip_address || agentReference.submitted_geolocation"
                    class="mt-3 text-xs text-gray-500 space-y-1">
                    <p v-if="agentReference.submitted_ip_address">IP: {{ agentReference.submitted_ip_address }}</p>
                    <p v-if="agentReference.submitted_geolocation" class="flex items-center gap-2">
                      Location: {{ formatGeolocationText(agentReference.submitted_geolocation) }}
                      <button type="button" class="text-primary underline"
                        @click="openGeolocationMap(agentReference.submitted_geolocation)">
                        Map
                      </button>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Residential Data Verification Comparison -->
            <div v-if="residentialComparisonTable.length && reference?.reference_type !== 'living_with_family'" class="bg-white border rounded-lg p-4">
              <div class="flex items-center justify-between mb-3">
                <h4 class="font-semibold text-gray-900">{{ landlordReference ? 'Landlord' : 'Agent' }} Reference Data Verification</h4>
                <span class="text-xs text-gray-500" v-if="residentialComparisonHasMismatch">
                  Differences detected—document rationale below.
                </span>
              </div>
              <p class="text-sm text-gray-600 mb-4">Compare tenant-provided information with reference details</p>
              <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200 text-sm">
                  <thead class="bg-gray-50">
                    <tr>
                      <th class="px-4 py-2 text-left font-medium text-gray-600 uppercase tracking-wide">Field</th>
                      <th class="px-4 py-2 text-left font-medium text-gray-600 uppercase tracking-wide">Tenant Provided</th>
                      <th class="px-4 py-2 text-left font-medium text-gray-600 uppercase tracking-wide">{{ landlordReference ? 'Landlord' : 'Agent' }} Confirmed</th>
                      <th class="px-4 py-2 text-center font-medium text-gray-600 uppercase tracking-wide">Status</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-100">
                    <tr v-for="row in residentialComparisonTable" :key="row.key" :class="row.status === 'mismatch'
                      ? 'bg-red-50'
                      : row.status === 'unknown'
                        ? 'bg-gray-50'
                        : ''">
                      <td class="px-4 py-2 font-medium text-gray-900">{{ row.label }}</td>
                      <td class="px-4 py-2 text-gray-900">{{ row.tenant }}</td>
                      <td class="px-4 py-2 text-gray-900">{{ row.reference }}</td>
                      <td class="px-4 py-2 text-center">
                        <span :class="[
                          'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                          comparisonBadgeClass(row.status)
                        ]">
                          {{ comparisonStatusLabel(row.status) }}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p v-if="residentialComparisonHasMismatch"
                class="mt-3 text-sm text-yellow-800 bg-yellow-50 border border-yellow-200 rounded-md p-3">
                Please add notes in this step explaining how you resolved these differences before proceeding.
              </p>
            </div>

            <!-- Verification Checks -->
            <div v-if="reference?.reference_type !== 'living_with_family'" class="bg-white border rounded-lg p-4">
              <h4 class="font-semibold text-gray-900 mb-3">Verification Checks</h4>
              <div class="space-y-3">
                <div class="flex items-start justify-between p-3 bg-gray-50 rounded">
                  <div class="flex-1">
                    <p class="text-sm font-medium text-gray-700">Do tenancy dates match application?</p>
                    <p class="text-xs text-gray-500 mt-1">Check previous tenancy dates align with declared residential
                      history
                    </p>
                  </div>
                  <div class="flex gap-2 ml-4">
                    <button @click="toggleResidentialCheck('tenancyDatesMatch', true)" :class="[
                      'px-3 py-1 text-xs font-medium rounded transition-all',
                      getResidentialCheckValue('tenancyDatesMatch') === true
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-green-100'
                    ]">
                      Pass
                    </button>
                    <button @click="toggleResidentialCheck('tenancyDatesMatch', false)" :class="[
                      'px-3 py-1 text-xs font-medium rounded transition-all',
                      getResidentialCheckValue('tenancyDatesMatch') === false
                        ? 'bg-red-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-red-100'
                    ]">
                      Fail
                    </button>
                  </div>
                </div>

                <div v-if="reference?.previous_landlord_email || (landlordReference || agentReference)"
                  class="flex items-start justify-between p-3 bg-gray-50 rounded">
                  <div class="flex-1">
                    <p class="text-sm font-medium text-gray-700">Are contact details verifiable?</p>
                    <p class="text-xs text-gray-500 mt-1">
                      {{ reference?.previous_landlord_email || landlordReference?.landlord_email ||
                        agentReference?.agent_email
                      }}
                    </p>
                  </div>
                  <div class="flex gap-2 ml-4">
                    <button @click="toggleResidentialCheck('contactDetailsVerifiable', true)" :class="[
                      'px-3 py-1 text-xs font-medium rounded transition-all',
                      getResidentialCheckValue('contactDetailsVerifiable') === true
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-green-100'
                    ]">
                      Pass
                    </button>
                    <button @click="toggleResidentialCheck('contactDetailsVerifiable', false)" :class="[
                      'px-3 py-1 text-xs font-medium rounded transition-all',
                      getResidentialCheckValue('contactDetailsVerifiable') === false
                        ? 'bg-red-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-red-100'
                    ]">
                      Fail
                    </button>
                  </div>
                </div>

                <div class="flex items-start justify-between p-3 bg-gray-50 rounded">
                  <div class="flex-1">
                    <p class="text-sm font-medium text-gray-700">Any conflicts vs. application?</p>
                    <p class="text-xs text-gray-500 mt-1">Check for discrepancies between reference and application data
                    </p>
                  </div>
                  <div class="flex gap-2 ml-4">
                    <button @click="toggleResidentialCheck('noConflicts', true)" :class="[
                      'px-3 py-1 text-xs font-medium rounded transition-all',
                      getResidentialCheckValue('noConflicts') === true
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-green-100'
                    ]">
                      Pass
                    </button>
                    <button @click="toggleResidentialCheck('noConflicts', false)" :class="[
                      'px-3 py-1 text-xs font-medium rounded transition-all',
                      getResidentialCheckValue('noConflicts') === false
                        ? 'bg-red-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-red-100'
                    ]">
                      Fail
                    </button>
                  </div>
                </div>

                <div v-if="landlordReference?.submitted_at || agentReference?.submitted_at"
                  class="flex items-start justify-between p-3 bg-gray-50 rounded">
                  <div class="flex-1">
                    <p class="text-sm font-medium text-gray-700">Reference response received and satisfactory?</p>
                    <p class="text-xs text-gray-500 mt-1">Review the full reference response for any red flags</p>
                  </div>
                  <div class="flex gap-2 ml-4">
                    <button @click="toggleResidentialCheck('referenceResponseSatisfactory', true)" :class="[
                      'px-3 py-1 text-xs font-medium rounded transition-all',
                      getResidentialCheckValue('referenceResponseSatisfactory') === true
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-green-100'
                    ]">
                      Pass
                    </button>
                    <button @click="toggleResidentialCheck('referenceResponseSatisfactory', false)" :class="[
                      'px-3 py-1 text-xs font-medium rounded transition-all',
                      getResidentialCheckValue('referenceResponseSatisfactory') === false
                        ? 'bg-red-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-red-100'
                    ]">
                      Fail
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Evidence Source Selection -->
            <div v-if="reference?.reference_type !== 'living_with_family'">
              <label class="block text-sm font-medium text-gray-700 mb-2">Evidence Sources Used</label>
              <div class="grid grid-cols-2 gap-3">
                <label v-for="source in evidenceSourceOptions.RESIDENTIAL" :key="source.evidence_type"
                  class="flex items-center p-3 border rounded-md cursor-pointer hover:bg-gray-50"
                  :class="steps[3]!.evidence_sources.includes(source.evidence_type) ? 'border-primary bg-primary/5' : 'border-gray-300'">
                  <input type="checkbox" :value="source.evidence_type" v-model="steps[3]!.evidence_sources"
                    class="mr-3 h-4 w-4 text-primary focus:ring-primary" />
                  <span class="text-sm">{{ source.display_label }}</span>
                </label>
              </div>
            </div>

            <!-- Notes -->
            <div>
              <p class="text-xs text-gray-500 mb-1">External Notes - these notes will be shown to the reference creator</p>
              <label class="block text-sm font-medium text-gray-700 mb-2">Notes</label>
              <textarea v-model="steps[3]!.notes" rows="3"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                placeholder="Add notes about landlord references, address history, etc."></textarea>
            </div>

            <!-- Pass/Fail -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Overall Result</label>
              <div class="flex gap-4">

                <!-- PASS -->
                <button @click="steps[3]!.overall_pass = true, steps[3]!.status = ''" :class="[
                  'flex-1 py-3 px-4 rounded-md font-medium transition-all',
                  steps[3]!.overall_pass === true
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-green-50'
                ]">
                  Pass
                </button>

                <!-- Pass with Minor Issue (AMBER) -->
                <button @click="steps[3]!.status = 'amber', steps[3]!.overall_pass = null" :class="[
                  'flex-1 py-3 px-4 rounded-md font-medium transition-all',
                  steps[3]!.status === 'amber' && steps[3]!.overall_pass === null
                    ? 'bg-amber-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-green-50'
                ]">
                  Pass with Minor Issue
                </button>

                <!-- FAIL -->
                <button @click="steps[3]!.overall_pass = false, steps[3]!.status = ''" :class="[
                  'flex-1 py-3 px-4 rounded-md font-medium transition-all',
                  steps[3]!.overall_pass === false
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-red-50'
                ]">
                  Fail
                </button>

              </div>

            </div>
          </div>
        </div>

        <!-- Step 5: Credit & TAS -->
        <div v-if="currentStep === 5">
          <h3 class="text-xl font-bold text-gray-900 mb-2">Step 5: Credit & TAS Decision</h3>
          <p class="text-gray-600 mb-6">Review credit and AML results, then make your final TAS decision.</p>

          <div class="space-y-6">
            <!-- Credit & AML Scores -->
            <div class="bg-white border rounded-lg p-4">
              <div class="flex items-center justify-between mb-3">
                <h4 class="font-semibold text-gray-900">Score Overview</h4>
                <span v-if="domainScores.checked_at" class="text-xs text-gray-500">
                  Last checked: {{ formatDate(domainScores.checked_at) }}
                </span>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="flex items-center justify-between px-3 py-3 rounded-lg bg-blue-50 border border-blue-100">
                  <div>
                    <p class="text-xs font-semibold text-blue-800 uppercase tracking-wide">Credit Score</p>
                  </div>
                  <div class="text-right">
                    <p class="text-2xl font-bold text-blue-900">
                      {{ domainScores.credit || 0 }}
                    </p>
                  </div>
                </div>
                <div
                  class="flex items-center justify-between px-3 py-3 rounded-lg bg-emerald-50 border border-emerald-100">
                  <div>
                    <p class="text-xs font-semibold text-emerald-800 uppercase tracking-wide">AML Score</p>
                  </div>
                  <div class="text-right">
                    <p class="text-2xl font-bold text-emerald-900">
                      {{ domainScores.aml || 0 }}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Credits and AML UI -->
            <div class="bg-white border rounded-lg p-6">
              <CreditsAndAmlUI v-if="reference?.status !== 'pending'"
                :verification="creditAndAmlVerification?.verification"
                :compliance-checks="creditAndAmlVerification?.complianceChecks ?? {}" :caller="'Staff'" />
              <div v-else class="bg-white rounded-lg shadow p-6">
                <svg class="w-6 h-6 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div class="text-center text-gray-600">Tenant has'nt submitted reference yet.</div>
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
                  <label v-for="source in evidenceSourceOptions.CREDIT_TAS" :key="source.evidence_type"
                    class="flex items-center p-3 border rounded-md cursor-pointer hover:bg-gray-50"
                    :class="steps[4]!.evidence_sources.includes(source.evidence_type) ? 'border-primary bg-primary/5' : 'border-gray-300'">
                    <input type="checkbox" :value="source.evidence_type" v-model="steps[4]!.evidence_sources"
                      class="mr-3 h-4 w-4 text-primary focus:ring-primary" />
                    <span class="text-sm">{{ source.display_label }}</span>
                  </label>
                </div>
              </div>

              <!-- TAS Decision Categories -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-3">Select TAS Category</label>
                <div class="grid grid-cols-2 gap-4">
                  <button @click="tasDecision = 'PASS'" :class="[
                    'p-4 rounded-lg border-2 text-left transition-all',
                    tasDecision === 'PASS'
                      ? 'border-green-600 bg-green-50'
                      : 'border-gray-300 bg-white hover:border-green-300'
                  ]">
                    <div class="flex items-center gap-2 mb-1">
                      <div :class="[
                        'w-4 h-4 rounded-full border-2',
                        tasDecision === 'PASS' ? 'border-green-600 bg-green-600' : 'border-gray-300'
                      ]">
                        <svg v-if="tasDecision === 'PASS'" class="w-full h-full text-white" fill="currentColor"
                          viewBox="0 0 12 12">
                          <circle cx="6" cy="6" r="3" />
                        </svg>
                      </div>
                      <span class="font-semibold text-green-700">Pass (Accept)</span>
                    </div>
                    <p class="text-xs text-gray-600 ml-6">Satisfactory applicant, recommend acceptance</p>
                  </button>

                  <button @click="tasDecision = 'PASS_WITH_GUARANTOR'" :class="[
                    'p-4 rounded-lg border-2 text-left transition-all',
                    tasDecision === 'PASS_WITH_GUARANTOR'
                      ? 'border-amber-600 bg-amber-50'
                      : 'border-gray-300 bg-white hover:border-amber-300'
                  ]">
                    <div class="flex items-center gap-2 mb-1">
                      <div :class="[
                        'w-4 h-4 rounded-full border-2',
                        tasDecision === 'PASS_WITH_GUARANTOR' ? 'border-amber-600 bg-amber-600' : 'border-gray-300'
                      ]">
                        <svg v-if="tasDecision === 'PASS_WITH_GUARANTOR'" class="w-full h-full text-white" fill="currentColor"
                          viewBox="0 0 12 12">
                          <circle cx="6" cy="6" r="3" />
                        </svg>
                      </div>
                      <span class="font-semibold text-amber-700">Pass with Guarantor</span>
                    </div>
                    <p class="text-xs text-gray-600 ml-6">Applicant passes but requires a guarantor</p>
                  </button>

                  <button @click="tasDecision = 'REFER'" :class="[
                    'p-4 rounded-lg border-2 text-left transition-all',
                    tasDecision === 'REFER'
                      ? 'border-yellow-600 bg-yellow-50'
                      : 'border-gray-300 bg-white hover:border-yellow-300'
                  ]">
                    <div class="flex items-center gap-2 mb-1">
                      <div :class="[
                        'w-4 h-4 rounded-full border-2',
                        tasDecision === 'REFER' ? 'border-yellow-600 bg-yellow-600' : 'border-gray-300'
                      ]">
                        <svg v-if="tasDecision === 'REFER'" class="w-full h-full text-white" fill="currentColor"
                          viewBox="0 0 12 12">
                          <circle cx="6" cy="6" r="3" />
                        </svg>
                      </div>
                      <span class="font-semibold text-yellow-700">Refer (Review Required)</span>
                    </div>
                    <p class="text-xs text-gray-600 ml-6">Requires landlord/agent review - must provide reason</p>
                  </button>

                  <button @click="tasDecision = 'FAIL'" :class="[
                    'p-4 rounded-lg border-2 text-left transition-all',
                    tasDecision === 'FAIL'
                      ? 'border-red-600 bg-red-50'
                      : 'border-gray-300 bg-white hover:border-red-300'
                  ]">
                    <div class="flex items-center gap-2 mb-1">
                      <div :class="[
                        'w-4 h-4 rounded-full border-2',
                        tasDecision === 'FAIL' ? 'border-red-600 bg-red-600' : 'border-gray-300'
                      ]">
                        <svg v-if="tasDecision === 'FAIL'" class="w-full h-full text-white" fill="currentColor"
                          viewBox="0 0 12 12">
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
                <textarea v-model="tasReason" rows="3"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                  placeholder="Explain the reason for this decision..." required></textarea>
              </div>

              <!-- Notes -->
              <div>
                <p class="text-xs text-gray-500 mb-1">External Notes - these notes will be shown to the reference creator</p>
                <label class="block text-sm font-medium text-gray-700 mb-2">Additional Notes<sup
                    class="text-red-500">*</sup></label>
                <textarea v-model="steps[4]!.notes" rows="3"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                  placeholder="Add notes about credit checks, sanctions screening, etc."></textarea>
              </div>

              <!-- Overall Pass/Fail -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Overall Step Result</label>
                <div class="flex gap-4">
                  <button @click="steps[4]!.overall_pass = true" :disabled="!canMakeStep4Decision" :class="[
                    'flex-1 py-3 px-4 rounded-md font-medium transition-all',
                    steps[4]!.overall_pass === true
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-green-50',
                    !canMakeStep4Decision ? 'opacity-50 cursor-not-allowed' : ''
                  ]">
                    Pass
                  </button>
                  <button @click="steps[4]!.overall_pass = false" :disabled="!canMakeStep4Decision" :class="[
                    'flex-1 py-3 px-4 rounded-md font-medium transition-all',
                    steps[4]!.overall_pass === false
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-red-50',
                    !canMakeStep4Decision ? 'opacity-50 cursor-not-allowed' : ''
                  ]">
                    Fail
                  </button>
                </div>
                <p v-if="!canMakeStep4Decision" class="mt-2 text-sm text-gray-500">
                  Please make a TAS decision above before making a final step result.
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Step 6: Preview & Finalize -->
        <div v-if="currentStep === 6" class="bg-white rounded-lg shadow-lg p-8">
          <!-- Re-assessment Loading State -->
          <div v-if="reAssessmentLoading" class="text-center py-20">
            <div class="inline-block animate-spin rounded-full h-16 w-16 border-b-2 border-primary mb-6"></div>
            <p class="text-gray-700 text-xl font-semibold mb-2">Re-assessing application score...</p>
            <p class="text-gray-500 text-sm">Please wait while we calculate the updated scores based on your
              verification decisions</p>
          </div>

          <!-- Re-assessment Error State -->
          <div v-else-if="reAssessmentError" class="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div class="flex items-start gap-3">
              <svg class="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor"
                viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 class="text-sm font-semibold text-red-800 mb-1">Failed to re-assess application</h3>
                <p class="text-sm text-red-700">{{ reAssessmentError }}</p>
                <button @click="triggerReAssessment"
                  class="mt-3 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md">
                  Retry
                </button>
              </div>
            </div>
          </div>

          <!-- Preview Content -->
          <div v-else>
            <div class="mb-6 text-center border-b pb-6">
              <h2 class="text-3xl font-bold text-gray-900 mb-2">Verification Preview</h2>
              <p class="text-gray-600">Review all verification steps before finalizing</p>
            </div>

            <!-- Assessment Scores -->
            <div class="mb-8 border-b pb-6">
              <h3 class="text-xl font-bold text-gray-900 mb-4">Assessment Scores</h3>

              <!-- Risk Score and Risk Level - Parallel -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <!-- Risk Score -->
                <div :class="[
                  'p-6 rounded-lg border-2',
                  riskScoreColorForPreview.border
                ]">
                  <p class="text-sm text-gray-600 uppercase tracking-wide mb-2">Risk Score</p>
                  <p :class="[
                    'text-4xl font-bold',
                    riskScoreColorForPreview.text
                  ]">{{ reassesmentDataForPreview.risk_score ?? '—' }}</p>
                  <p class="text-xs text-gray-500 mt-1">Total assessment score</p>
                </div>

                <!-- Risk Level -->
                <div class="p-6 rounded-lg border-2 border-gray-200">
                  <p class="text-sm text-gray-600 uppercase tracking-wide mb-2">Risk Level</p>
                  <div class="flex items-center gap-3">
                    <span :class="[
                      'px-4 py-2 rounded-lg text-lg font-bold',
                      reassesmentDataForPreview.risk_level === 'very_high' ? 'bg-red-100 text-red-800 border-2 border-red-300' :
                        reassesmentDataForPreview.risk_level === 'high' ? 'bg-orange-100 text-orange-800 border-2 border-orange-300' :
                          reassesmentDataForPreview.risk_level === 'medium' ? 'bg-yellow-100 text-yellow-800 border-2 border-yellow-300' :
                            reassesmentDataForPreview.risk_level === 'low' ? 'bg-green-100 text-green-800 border-2 border-green-300' :
                              'bg-gray-100 text-gray-800 border-2 border-gray-300'
                    ]">
                      {{ reassesmentDataForPreview.risk_level ?
                        reassesmentDataForPreview.risk_level.toUpperCase().replace('_', ' ') : 'N/A' }}
                    </span>
                  </div>
                  <p v-if="reassesmentDataForPreview.risk_level" class="text-xs text-gray-500 mt-2">
                    {{ reassesmentDataForPreview.risk_level === 'very_high' ? 'Very high risk applicant' :
                      reassesmentDataForPreview.risk_level === 'high' ? 'High risk applicant' :
                        reassesmentDataForPreview.risk_level === 'medium' ? 'Medium risk applicant' :
                          reassesmentDataForPreview.risk_level === 'low' ? 'Low risk applicant' : '' }}
                  </p>
                </div>
              </div>

              <div class="mb-6">
                <p class="text-sm font-semibold text-gray-700 mb-3">Decision</p>
                <span v-if="reassesmentDataForPreview.decision"
                  :class="getStatusChipClasses(reassesmentDataForPreview.decision)"
                  class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold">
                  {{ formatStatusText(reassesmentDataForPreview.decision) }}
                </span>
              </div>

              <!-- Critical Flags Section -->
              <div class="mb-6">
                <p class="text-sm font-semibold text-gray-700 mb-3">Critical Flags</p>
                <div v-if="activeGatesForPreview.length > 0" class="flex flex-wrap gap-2">
                  <span v-for="gate in activeGatesForPreview" :key="gate.key"
                    class="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-300">
                    {{ gate.label }}
                  </span>
                </div>
                <div v-else class="text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                  None
                </div>
              </div>

              <!-- Score Breakdown -->
              <div>
                <p class="text-sm font-semibold text-gray-700 mb-3">Score Breakdown</p>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <!-- Income Score with Band -->
                  <div class="bg-indigo-50 p-4 rounded-lg border border-indigo-200 shadow-sm">
                    <div class="flex items-center justify-between">
                      <div>
                        <p class="text-xs text-indigo-600 uppercase tracking-wide mb-1">Income Score</p>
                        <p class="text-2xl font-bold text-indigo-900">
                          {{ reassesmentDataForPreview.domains.income ?? '—' }}
                        </p>
                        <p v-if="reassesmentDataForPreview.domains.income_band"
                          class="text-xs capitalize text-gray-500 mt-1">
                          Income band:
                          {{
                            reassesmentDataForPreview.domains.income_band.replace('_', ' ') }}</p>
                      </div>
                      <div class="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                        <svg class="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  <!-- RTR -->
                  <div class="bg-blue-50 p-4 rounded-lg border border-blue-200 shadow-sm">
                    <div class="flex items-center justify-between">
                      <div>
                        <p class="text-xs text-blue-600 uppercase tracking-wide mb-1">RTR</p>
                        <p class="text-2xl font-bold text-blue-900">{{ reassesmentDataForPreview.domains.rtr ?? '—' }}
                        </p>
                      </div>
                      <div class="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                        <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  <!-- AML -->
                  <div class="bg-emerald-50 p-4 rounded-lg border border-emerald-200 shadow-sm">
                    <div class="flex items-center justify-between">
                      <div>
                        <p class="text-xs text-emerald-600 uppercase tracking-wide mb-1">AML</p>
                        <p class="text-2xl font-bold text-emerald-900">{{ reassesmentDataForPreview.domains.aml ?? '—'
                          }}</p>
                      </div>
                      <div class="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                        <svg class="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  <!-- Credit -->
                  <div class="bg-blue-50 p-4 rounded-lg border border-blue-200 shadow-sm">
                    <div class="flex items-center justify-between">
                      <div>
                        <p class="text-xs text-blue-600 uppercase tracking-wide mb-1">Credit</p>
                        <p class="text-2xl font-bold text-blue-900">{{ reassesmentDataForPreview.domains.credit ?? '—'
                          }}</p>
                      </div>
                      <div class="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                        <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  <!-- Residential -->
                  <div class="bg-orange-50 p-4 rounded-lg border border-orange-200 shadow-sm">
                    <div class="flex items-center justify-between">
                      <div>
                        <p class="text-xs text-orange-600 uppercase tracking-wide mb-1">Residential</p>
                        <p class="text-2xl font-bold text-orange-900">{{ reassesmentDataForPreview.domains.residential
                          ?? '—' }}
                        </p>
                      </div>
                      <div class="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                        <svg class="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Verification Steps Summary -->
            <div class="mb-8">
              <h3 class="text-xl font-bold text-gray-900 mb-4">Verification Steps Summary</h3>
              <div class="space-y-4">
                <!-- Step 1: ID & Selfie -->
                <div class="border rounded-lg p-4">
                  <div class="flex items-center justify-between mb-2">
                    <h4 class="font-semibold text-gray-900">Step 1: Identity Verification</h4>
                    <span :class="[
                      'px-3 py-1 rounded-full text-xs font-semibold',
                      steps[0]!.overall_pass === true ? 'bg-green-100 text-green-800' :
                        steps[0]!.overall_pass === false ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-600'
                    ]">
                      {{ steps[0]!.overall_pass === true ? 'PASS' : steps[0]!.overall_pass === false ? 'FAIL' :
                        'PENDING'
                      }}
                    </span>
                  </div>
                  <p v-if="steps[0]!.notes" class="text-sm text-gray-600 mt-2">{{ steps[0]!.notes }}</p>
                </div>

                <!-- Step 2: RTR Verification -->
                <div class="border rounded-lg p-4">
                  <div class="flex items-center justify-between mb-2">
                    <h4 class="font-semibold text-gray-900">Step 2: RTR Verification</h4>
                    <span :class="[
                      'px-3 py-1 rounded-full text-xs font-semibold',
                      steps[1]!.overall_pass === true ? 'bg-green-100 text-green-800' :
                        steps[1]!.overall_pass === false ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-600'
                    ]">
                      {{ steps[1]!.overall_pass === true ? 'PASS' : steps[1]!.overall_pass === false ? 'FAIL' :
                        'PENDING'
                      }}
                    </span>
                  </div>
                  <p v-if="steps[1]!.notes" class="text-sm text-gray-600 mt-2">{{ steps[1]!.notes }}</p>
                </div>

                <!-- Step 3: Income & Affordability -->
                <div class="border rounded-lg p-4">
                  <div class="flex items-center justify-between mb-2">
                    <h4 class="font-semibold text-gray-900">Step 3: Income & Affordability</h4>
                    <span :class="[
                      'px-3 py-1 rounded-full text-xs font-semibold',
                      steps[2]!.status === 'GUARANTOR_NEEDED' ? 'bg-amber-100 text-amber-800' :
                        steps[2]!.overall_pass === true ? 'bg-green-100 text-green-800' :
                          steps[2]!.overall_pass === false ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-600'
                    ]">
                      {{ steps[2]!.status === 'GUARANTOR_NEEDED' ? 'GUARANTOR NEEDED' :
                        steps[2]!.overall_pass === true ? 'PASS' : steps[2]!.overall_pass === false ? 'FAIL' : 'PENDING'
                      }}
                    </span>
                  </div>
                  <p v-if="steps[2]!.notes" class="text-sm text-gray-600 mt-2">{{ steps[2]!.notes }}</p>
                </div>

                <!-- Step 4: Residential -->
                <div class="border rounded-lg p-4">
                  <div class="flex items-center justify-between mb-2">
                    <h4 class="font-semibold text-gray-900">Step 4: Residential Verification</h4>
                    <span :class="[
                      'px-3 py-1 rounded-full text-xs font-semibold',
                      steps[3]!.status === 'amber' ? 'bg-amber-100 text-amber-800' :
                        steps[3]!.overall_pass === true ? 'bg-green-100 text-green-800' :
                          steps[3]!.overall_pass === false ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-600'
                    ]">
                      {{ steps[3]!.status === 'amber' ? 'Pass with Minor Issue' :
                        steps[3]!.overall_pass === true ? 'PASS' : steps[3]!.overall_pass === false ? 'FAIL' : 'PENDING'
                      }}
                    </span>
                  </div>
                  <p v-if="steps[3]!.notes" class="text-sm text-gray-600 mt-2">{{ steps[3]!.notes }}</p>
                </div>

                <!-- Step 5: Credit & TAS -->
                <div class="border rounded-lg p-4">
                  <div class="flex items-center justify-between mb-2">
                    <h4 class="font-semibold text-gray-900">Step 5: Credit & TAS Decision</h4>
                    <span :class="[
                      'px-3 py-1 rounded-full text-xs font-semibold',
                      steps[4]!.overall_pass === true ? 'bg-green-100 text-green-800' :
                        steps[4]!.overall_pass === false && tasDecision !== 'REFER' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-600'
                    ]">
                      {{ steps[4]!.overall_pass === true ? 'PASS' : steps[4]!.overall_pass === false && tasDecision !==
                        'REFER'
                        ? 'FAIL' :
                      'PENDING'
                      }}
                    </span>
                  </div>
                  <div v-if="tasDecision" class="mt-2">
                    <p class="text-sm text-gray-600 rounded-md p-2 bg-gray-100 w-full"><strong>TAS Category:</strong> {{
                      formatTasCategory(tasDecision) }}</p>
                    <p v-if="tasReason" class="text-sm text-gray-600 mt-1 rounded-md p-2 bg-gray-100 w-">
                      <strong>Reason:</strong> {{ tasReason }}
                    </p>
                  </div>
                  <p v-if="steps[4]!.notes" class="text-sm text-gray-600 mt-2">{{ steps[4]!.notes }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Navigation Buttons -->
        <div class="flex justify-between mt-8 pt-6 border-t">
          <button v-if="currentStep > 1" @click="previousStep"
            class="px-6 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md font-medium">
            Previous
          </button>
          <div v-else></div>

          <div class="flex gap-3">
            <button v-if="currentStep < 6" @click="nextStep" :disabled="!canProceed"
              class="px-6 py-2 text-white bg-primary hover:bg-primary-dark rounded-md font-medium disabled:opacity-50">
              {{ currentStep === 5 ? 'Proceed to Preview' : 'Next Step' }}
            </button>
            <template v-else>
              <button @click="handleReject"
                class="px-6 py-2 text-white bg-red-600 hover:bg-red-700 rounded-md font-medium">
                Reject
              </button>
              <button @click="handleFinalize"
                class="px-6 py-2 text-white bg-green-600 hover:bg-green-700 rounded-md font-medium">
                Finalize
              </button>
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- Confirmation Modal -->
    <div v-if="showConfirmationModal" class="fixed inset-0 z-50 overflow-y-auto" @click.self="cancelAction">
      <div class="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <!-- Background overlay -->
        <div class="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" @click="cancelAction"></div>

        <!-- Modal panel -->
        <div
          class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full"
          @click.stop>
          <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div class="sm:flex sm:items-start">
              <div :class="[
                'mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full sm:mx-0 sm:h-10 sm:w-10',
                pendingAction === 'finalize' ? 'bg-green-100' : 'bg-red-100'
              ]">
                <svg v-if="pendingAction === 'finalize'" class="h-6 w-6 text-green-600" fill="none"
                  stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <svg v-else class="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                <h3 class="text-lg leading-6 font-medium text-gray-900">
                  {{ pendingAction === 'finalize' ? 'Finalize Verification' : 'Reject Application' }}
                </h3>
                <div class="mt-2">
                  <p class="text-sm text-gray-500">
                    This will mark the application as {{ pendingAction === 'finalize' ? 'finalized' : 'rejected' }}. Do
                    you
                    want to proceed?
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div class="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button @click="proceedWithAction" :class="[
              'w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white sm:ml-3 sm:w-auto sm:text-sm',
              pendingAction === 'finalize' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
            ]">
              {{ processing ? 'Processing...' : 'Proceed' }}
            </button>
            <button @click="cancelAction" :disabled="processing"
              class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Request Document Modal -->
    <div v-if="showRequestDocumentModal" class="fixed inset-0 z-50 overflow-y-auto" @click.self="showRequestDocumentModal = false">
      <div class="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <!-- Background overlay -->
        <div class="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" @click="showRequestDocumentModal = false"></div>

        <!-- Modal panel -->
        <div class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full" @click.stop>
          <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div class="sm:flex sm:items-start">
              <div class="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-amber-100 sm:mx-0 sm:h-10 sm:w-10">
                <svg class="h-6 w-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left flex-1">
                <h3 class="text-lg leading-6 font-medium text-gray-900">
                  Request {{ documentTypeLabels[requestDocumentType] || 'Document' }}
                </h3>
                <div class="mt-2">
                  <p class="text-sm text-gray-500 mb-4">
                    This will send an email to the tenant requesting they upload this document. The reference will be pushed back to "In Progress" status.
                  </p>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Additional message (optional)</label>
                    <textarea v-model="requestDocumentMessage" rows="3" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" placeholder="Add any specific instructions for the tenant..."></textarea>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button @click="sendDocumentRequest" :disabled="requestDocumentLoading"
              class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary text-base font-medium text-white hover:bg-primary/90 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50">
              {{ requestDocumentLoading ? 'Sending...' : 'Send Request & Push Back' }}
            </button>
            <button @click="showRequestDocumentModal = false" :disabled="requestDocumentLoading"
              class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useToast } from 'vue-toastification'
import { useAuthStore } from '../stores/auth'
import SideBySideViewer from '../components/SideBySideViewer.vue'
import CreditsAndAmlUI, { type Props as CreditsAndAmlUIProps } from '../components/CreditsAndAmlUI.vue'
import { formatDate as formatUkDate } from '../utils/date'
// Reuse country helper if available for future enhancements
// import { getCountryName } from '../utils/countries'

const router = useRouter()
const route = useRoute()
const toast = useToast()
const authStore = useAuthStore()
const API_URL = import.meta.env.VITE_API_URL

// State
const loading = ref(true)
const error = ref<string | null>(null)
const currentStep = ref(1)
const reference = ref<any>(null)
const previousAddresses = ref<any[]>([])
const workItemId = ref<string | null>(null)
const idDocumentBlobUrl = ref('')
const selfieBlobUrl = ref('')
const landlordReference = ref<any>(null)
const agentReference = ref<any>(null)
const employerReference = ref<any>(null)
const accountantReference = ref<any>(null)
const guarantorReference = ref<any>(null)
const payslipPreviewUrl = ref('')
const selectedPayslipIndex = ref<number | null>(null)
const proofOfAddressBlobUrl = ref('')
const proofOfAddressIsPdf = ref(false)
const rtrAlternativeDocumentBlobUrl = ref('')
const rtrAlternativeDocumentIsPdf = ref(false)
const taxReturnPreviewUrl = ref('')
const proofOfFundsPreviewUrl = ref('')
const proofOfAdditionalIncomePreviewUrl = ref('')
// const creditsafeData = ref<any>(null)
// const creditsafeLoading = ref(false)

// Modal state
const showConfirmationModal = ref(false)
const pendingAction = ref<'finalize' | 'reject' | null>(null)

// Document request modal state
const showRequestDocumentModal = ref(false)
const requestDocumentType = ref('')
const requestDocumentMessage = ref('')
const requestDocumentLoading = ref(false)
const uploadingDocument = ref(false)

const documentTypeLabels: Record<string, string> = {
  'id_document': 'ID Document',
  'selfie': 'Selfie',
  'proof_of_address': 'Proof of Address',
  'proof_of_funds': 'Proof of Funds',
  'proof_of_additional_income': 'Proof of Additional Income',
  'bank_statements': 'Bank Statements',
  'payslips': 'Payslips',
  'tax_return': 'Tax Return',
  'rtr_alternative_document': 'Right to Rent Alternative Document'
}

// Re-assessment state
const reAssessmentLoading = ref(false)
const reAssessmentError = ref<string | null>(null)

const stepLabels = ['ID & Selfie', 'RTR Verification', 'Income & Affordability', 'Residential', 'Credit & TAS', 'Preview']

type SimpleComparisonStatus = 'match' | 'mismatch' | 'unknown'
interface EmploymentComparisonDisplayRow {
  key: string
  label: string
  tenant: string
  employer: string
  status: SimpleComparisonStatus
}

interface AccountantComparisonDisplayRow {
  key: string
  label: string
  tenant: string
  accountant: string
  status: SimpleComparisonStatus
}

interface ResidentialComparisonDisplayRow {
  key: string
  label: string
  tenant: string
  reference: string
  status: SimpleComparisonStatus
}

// Type definition for verification step
interface VerificationStep {
  step_number: number
  step_type: string
  overall_pass: boolean | null
  notes: string
  evidence_sources: any[]
  checks: any[]
  status?: string
}

// Step data
const steps = ref<VerificationStep[]>([
  { step_number: 1, step_type: 'ID_SELFIE', overall_pass: null, notes: '', evidence_sources: [], checks: [] },
  { step_number: 2, step_type: 'RTR_VERIFICATION', overall_pass: null, notes: '', evidence_sources: [], checks: [] },
  { step_number: 3, step_type: 'INCOME_AFFORDABILITY', overall_pass: null, notes: '', evidence_sources: [], checks: [] },
  { step_number: 4, step_type: 'RESIDENTIAL', overall_pass: null, notes: '', evidence_sources: [], checks: [], status: '' },
  { step_number: 5, step_type: 'CREDIT_TAS', overall_pass: null, notes: '', evidence_sources: [], checks: [] }
])

// TAS decision
const tasDecision = ref<'PASS' | 'PASS_WITH_GUARANTOR' | 'REFER' | 'FAIL' | null>(null)
const tasReason = ref('')

type CreditAndAmlVerification = Omit<CreditsAndAmlUIProps, 'caller'>
const creditAndAmlVerification = ref<CreditAndAmlVerification>()


// Evidence source options
const evidenceSourceOptions = ref<any>({
  INCOME_AFFORDABILITY: [],
  RESIDENTIAL: [],
  CREDIT_TAS: [],
  RTR_VERIFICATION: []
})
const formatBooleanDisplay = (value: boolean | string | null | undefined) => {
  if (value === true || value === 'yes') return 'Yes'
  if (value === false || value === 'no') return 'No'
  if (typeof value === 'string' && value.trim()) return value.charAt(0).toUpperCase() + value.slice(1)
  return 'Not provided'
}

const formatTasCategory = (category: string | null): string => {
  if (!category) return ''
  return category
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

//const hasTenantDocuments = computed(() => tenantDocuments.value.length > 0)



const formatGeolocationText = (geo: any) => {
  if (!geo || typeof geo.latitude !== 'number' || typeof geo.longitude !== 'number') {
    return 'Not provided'
  }
  const lat = geo.latitude.toFixed(5)
  const lng = geo.longitude.toFixed(5)
  const accuracy = geo.accuracy ? `±${Math.round(geo.accuracy)}m` : null
  return accuracy ? `${lat}, ${lng} (${accuracy})` : `${lat}, ${lng}`
}

const formatStatusText = (status: string | null | undefined): string => {
  if (!status) return 'Unknown'
  const statusMap: Record<string, string> = {
    pending: 'Pending',
    in_progress: 'In Progress',
    pending_verification: 'Pending Verification',
    completed: 'Completed',
    cancelled: 'Cancelled',
    rejected: 'Rejected',
    // Decision values
    superb: 'Superb',
    pass: 'Pass',
    pass_with_guarantor: 'Pass with Guarantor',
    fail: 'Fail',
    decline: 'Decline',
    no_decision: 'No Decision'
  }
  return statusMap[status.toLowerCase()] || status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

const getStatusChipClasses = (status: string | null | undefined): string => {
  if (!status) return 'bg-gray-100 text-gray-700'

  const statusLower = status.toLowerCase()

  switch (statusLower) {
    case 'pending':
      return 'bg-yellow-100 text-yellow-800'
    case 'in_progress':
      return 'bg-blue-100 text-blue-800'
    case 'pending_verification':
      return 'bg-orange-100 text-orange-800'
    case 'completed':
      return 'bg-green-100 text-green-800'
    case 'cancelled':
      return 'bg-gray-100 text-gray-700'
    case 'rejected':
      return 'bg-red-100 text-red-800'
    case 'superb':
      return 'bg-green-100 text-green-800'
    case 'fail':
      return 'bg-red-100 text-red-800'
    case 'pass_with_guarantor':
      return 'bg-orange-100 text-orange-800'
    case 'pass':
      return 'bg-green-100 text-green-800'
    default:
      return 'bg-gray-100 text-gray-700'
  }
}

const openGeolocationMap = (geo: any) => {
  if (typeof window === 'undefined') return
  if (!geo || typeof geo.latitude !== 'number' || typeof geo.longitude !== 'number') return
  const url = `https://www.google.com/maps?q=${geo.latitude},${geo.longitude}`
  window.open(url, '_blank', 'noopener')
}

const normalizeTextValue = (value: any): string => {
  if (value === null || value === undefined) return ''
  return String(value).trim().toLowerCase()
}

const parseCurrencyNumber = (value: any): number | null => {
  if (value === null || value === undefined || value === '') return null
  const parsed = parseFloat(String(value).replace(/[^0-9.-]+/g, ''))
  return isNaN(parsed) ? null : parsed
}

const formatCurrencyDisplay = (value: any): string => {
  const parsed = parseCurrencyNumber(value)
  if (parsed === null) {
    return value && value !== '' ? String(value) : 'Not provided'
  }
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(parsed)
}

const formatTextDisplay = (value: any): string => {
  if (value === null || value === undefined || value === '') return 'Not provided'
  return String(value)
}

const formatDateDisplay = (value?: string | null) => {
  if (!value) return 'Not provided'
  return formatUkDate(
    value,
    {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    },
    'Not provided'
  )
}

const compareTextValues = (tenant: any, employer: any): SimpleComparisonStatus => {
  const tenantValue = normalizeTextValue(tenant)
  const employerValue = normalizeTextValue(employer)
  if (!tenantValue || !employerValue) return 'unknown'
  return tenantValue === employerValue ? 'match' : 'mismatch'
}

const compareCurrencyValues = (tenant: any, employer: any): SimpleComparisonStatus => {
  const tenantValue = parseCurrencyNumber(tenant)
  const employerValue = parseCurrencyNumber(employer)
  if (tenantValue === null || employerValue === null) return 'unknown'
  const variance = Math.abs(tenantValue - employerValue)
  const tolerance = Math.max(1, tenantValue * 0.05)
  return variance <= tolerance ? 'match' : 'mismatch'
}

const comparisonBadgeClass = (status: SimpleComparisonStatus) => {
  if (status === 'match') return 'bg-green-100 text-green-800'
  if (status === 'mismatch') return 'bg-red-100 text-red-800'
  return 'bg-gray-100 text-gray-600'
}

const comparisonStatusLabel = (status: SimpleComparisonStatus) => {
  if (status === 'match') return 'Match'
  if (status === 'mismatch') return 'Mismatch'
  return 'Not Provided'
}

const annualSalary = ref<number>(0);

const employmentComparisonTable = computed<EmploymentComparisonDisplayRow[]>(() => {
  if (!reference.value || !employerReference.value) return []

  const tenant = reference.value
  const employer = employerReference.value
  const salary = parseFloat(tenant.employment_salary_amount || '0')
  let annualSalaryValue = salary;
  if (tenant.employment_is_hourly && tenant.employment_hours_per_month) {
    annualSalaryValue = salary * tenant.employment_hours_per_month * 12;
  }
  annualSalary.value = annualSalaryValue;

  const rows: EmploymentComparisonDisplayRow[] = [
    {
      key: 'company',
      label: 'Company',
      tenant: formatTextDisplay(tenant.employment_company_name),
      employer: formatTextDisplay(employer.company_name),
      status: compareTextValues(tenant.employment_company_name, employer.company_name)
    },
    {
      key: 'position',
      label: 'Job Title',
      tenant: formatTextDisplay(tenant.employment_job_title),
      employer: formatTextDisplay(employer.employee_position),
      status: compareTextValues(tenant.employment_job_title, employer.employee_position)
    },
    {
      key: 'start_date',
      label: 'Employment Start Date',
      tenant: formatDateDisplay(tenant.employment_start_date),
      employer: formatDateDisplay(employer.employment_start_date),
      status: compareTextValues(tenant.employment_start_date, employer.employment_start_date)
    },
    {
      key: 'salary',
      label: 'Annual Salary',
      tenant: formatCurrencyDisplay(annualSalaryValue),
      employer: formatCurrencyDisplay(annualSalaryValue),
      status: compareCurrencyValues(tenant.employment_salary_amount, employer.annual_salary)
    },
    {
      key: 'contact_name',
      label: 'Reference Contact',
      tenant: formatTextDisplay(tenant.employer_ref_name),
      employer: formatTextDisplay(employer.employer_name),
      status: compareTextValues(tenant.employer_ref_name, employer.employer_name)
    },
    {
      key: 'contact_email',
      label: 'Reference Email',
      tenant: formatTextDisplay(tenant.employer_ref_email),
      employer: formatTextDisplay(employer.employer_email),
      status: compareTextValues(tenant.employer_ref_email, employer.employer_email)
    }
  ]

  return rows
})

const employmentComparisonHasMismatch = computed(() =>
  employmentComparisonTable.value.some(row => row.status === 'mismatch')
)

// Accountant comparison table
const accountantComparisonTable = computed<AccountantComparisonDisplayRow[]>(() => {
  if (!reference.value || !accountantReference.value || !accountantReference.value.submitted_at) return []

  const tenant = reference.value
  const accountant = accountantReference.value

  const rows: AccountantComparisonDisplayRow[] = [
    {
      key: 'business_name',
      label: 'Business Name',
      tenant: formatTextDisplay(tenant.self_employed_business_name),
      accountant: formatTextDisplay(accountant.business_name),
      status: compareTextValues(tenant.self_employed_business_name, accountant.business_name)
    },
    {
      key: 'nature_of_business',
      label: 'Nature of Business',
      tenant: formatTextDisplay(tenant.self_employed_nature_of_business),
      accountant: formatTextDisplay(accountant.nature_of_business),
      status: compareTextValues(tenant.self_employed_nature_of_business, accountant.nature_of_business)
    },
    {
      key: 'start_date',
      label: 'Business Start Date',
      tenant: formatDateDisplay(tenant.self_employed_start_date),
      accountant: formatDateDisplay(accountant.business_start_date),
      status: compareTextValues(tenant.self_employed_start_date, accountant.business_start_date)
    },
    {
      key: 'annual_income',
      label: 'Annual Income',
      tenant: formatCurrencyDisplay(parseFloat(tenant.self_employed_annual_income || '0')),
      accountant: accountant.estimated_monthly_income
        ? formatCurrencyDisplay(parseFloat(accountant.estimated_monthly_income) * 12)
        : 'Not provided',
      status: compareCurrencyValues(
        tenant.self_employed_annual_income,
        accountant.estimated_monthly_income ? parseFloat(accountant.estimated_monthly_income) * 12 : null
      )
    },
    {
      key: 'accountant_firm',
      label: 'Accountant Firm',
      tenant: formatTextDisplay(tenant.accountant_name),
      accountant: formatTextDisplay(accountant.accountant_firm || accountant.firm_name),
      status: compareTextValues(tenant.accountant_name, accountant.accountant_firm || accountant.firm_name)
    },
    {
      key: 'accountant_contact',
      label: 'Accountant Contact',
      tenant: formatTextDisplay(tenant.accountant_contact_name),
      accountant: formatTextDisplay(accountant.accountant_name),
      status: compareTextValues(tenant.accountant_contact_name, accountant.accountant_name)
    },
    {
      key: 'accountant_email',
      label: 'Accountant Email',
      tenant: formatTextDisplay(tenant.accountant_email),
      accountant: formatTextDisplay(accountant.accountant_email),
      status: compareTextValues(tenant.accountant_email, accountant.accountant_email)
    }
  ]

  return rows
})

const accountantComparisonHasMismatch = computed(() =>
  accountantComparisonTable.value.some(row => row.status === 'mismatch')
)

// Residential (landlord/agent) comparison table
const residentialComparisonTable = computed<ResidentialComparisonDisplayRow[]>(() => {
  if (!reference.value) return []

  const tenant = reference.value
  const refData = landlordReference.value || agentReference.value
  if (!refData || !refData.submitted_at) return []

  const isLandlord = !!landlordReference.value

  const rows: ResidentialComparisonDisplayRow[] = [
    {
      key: 'property_address',
      label: 'Property Address',
      tenant: formatTextDisplay(tenant.previous_rental_address_line1),
      reference: formatTextDisplay(refData.property_address),
      status: compareTextValues(tenant.previous_rental_address_line1, refData.property_address)
    },
    {
      key: 'property_city',
      label: 'Property City',
      tenant: formatTextDisplay(tenant.previous_rental_city),
      reference: formatTextDisplay(refData.property_city),
      status: compareTextValues(tenant.previous_rental_city, refData.property_city)
    },
    {
      key: 'property_postcode',
      label: 'Property Postcode',
      tenant: formatTextDisplay(tenant.previous_rental_postcode),
      reference: formatTextDisplay(refData.property_postcode),
      status: compareTextValues(tenant.previous_rental_postcode, refData.property_postcode)
    },
    {
      key: 'contact_name',
      label: isLandlord ? 'Landlord Name' : 'Agent Name',
      tenant: formatTextDisplay(tenant.previous_landlord_name),
      reference: formatTextDisplay(isLandlord ? refData.landlord_name : refData.agent_name),
      status: compareTextValues(tenant.previous_landlord_name, isLandlord ? refData.landlord_name : refData.agent_name)
    },
    ...(!isLandlord ? [{
      key: 'agency_name',
      label: 'Agency Name',
      tenant: formatTextDisplay(tenant.previous_agency_name),
      reference: formatTextDisplay(refData.agency_name),
      status: compareTextValues(tenant.previous_agency_name, refData.agency_name)
    }] : []),
    {
      key: 'contact_email',
      label: isLandlord ? 'Landlord Email' : 'Agent Email',
      tenant: formatTextDisplay(tenant.previous_landlord_email),
      reference: formatTextDisplay(isLandlord ? refData.landlord_email : refData.agent_email),
      status: compareTextValues(tenant.previous_landlord_email, isLandlord ? refData.landlord_email : refData.agent_email)
    },
    {
      key: 'contact_phone',
      label: isLandlord ? 'Landlord Phone' : 'Agent Phone',
      tenant: formatTextDisplay(tenant.previous_landlord_phone),
      reference: formatTextDisplay(isLandlord ? refData.landlord_phone : refData.agent_phone),
      status: compareTextValues(tenant.previous_landlord_phone, isLandlord ? refData.landlord_phone : refData.agent_phone)
    },
    {
      key: 'tenancy_start',
      label: 'Tenancy Start Date',
      tenant: formatDateDisplay(tenant.previous_tenancy_start_date),
      reference: formatDateDisplay(refData.tenancy_start_date),
      status: compareTextValues(tenant.previous_tenancy_start_date, refData.tenancy_start_date)
    },
    {
      key: 'tenancy_end',
      label: 'Tenancy End Date',
      tenant: formatDateDisplay(tenant.previous_tenancy_end_date),
      reference: refData.tenancy_still_in_progress
        ? '🚩 STILL IN CONTRACT - No end date'
        : formatDateDisplay(refData.tenancy_end_date),
      status: refData.tenancy_still_in_progress
        ? (tenant.previous_tenancy_end_date ? 'mismatch' : 'unknown')
        : compareTextValues(tenant.previous_tenancy_end_date, refData.tenancy_end_date)
    },
    {
      key: 'monthly_rent',
      label: 'Monthly Rent',
      tenant: tenant.previous_monthly_rent ? `£${tenant.previous_monthly_rent}` : 'Not provided',
      reference: refData.monthly_rent ? `£${refData.monthly_rent}` : 'Not provided',
      status: compareCurrencyValues(tenant.previous_monthly_rent, refData.monthly_rent)
    }
  ]

  return rows
})

const residentialComparisonHasMismatch = computed(() =>
  residentialComparisonTable.value.some(row => row.status === 'mismatch')
)

// Computed
const canMakeStep2Decision = computed(() => {
  return true
})

const canMakeStep4Decision = computed(() => {
  return tasDecision.value !== null
})

const canProceed = computed(() => {
  const step = steps.value[currentStep.value - 1]
  if (!step) return false

  if (currentStep.value === 1) {
    return step.overall_pass !== null
  }

  const a = step.overall_pass !== null || (step.status === 'amber' || step.status === 'GUARANTOR_NEEDED')
  return a
})

const isBritishCitizen = computed(() => {
  if (!reference.value) return false
  const nationality = reference.value.nationality?.toUpperCase()
  const addressCountry = reference.value.address_country?.toUpperCase()
  return nationality === 'BRITISH' || addressCountry === 'BRITISH'
})

// Gates (preview-only, static data for now)
const previewGates = ref([
  { key: 'RTR_FAIL', label: 'RTR Verification Failed', active: false },
  { key: 'RES_REF_FAIL', label: 'Residential Reference Failed', active: false },
  { key: 'CREDIT_AML_2PLUS_FAILS', label: 'Credit & AML Multiple Failures', active: false },
  { key: 'SCORE_BELOW_MIN', label: 'Score Below Minimum Threshold', active: false }
])

// Filter to show only active gates
const activeGates = computed(() => {
  return previewGates.value.filter(gate => gate.active)
})

const activeGatesForPreview = computed(() => {
  return reassesmentDataForPreview.value.gates.filter(gate => gate.active)
})

// Risk Score color coding
const riskScoreColorForPreview = computed(() => {
  const score = reassesmentDataForPreview.value.risk_score ?? 0
  if (score > 799) {
    return {
      text: 'text-green-600',
      border: 'border-green-300'
    }
  } else if (score > 649) {
    return {
      text: 'text-yellow-600',
      border: 'border-yellow-300'
    }
  } else {
    return {
      text: 'text-red-600',
      border: 'border-red-300'
    }
  }
})

const handleReject = () => {
  pendingAction.value = 'reject'
  showConfirmationModal.value = true
}

const handleFinalize = () => {
  pendingAction.value = 'finalize'
  showConfirmationModal.value = true
}

const processing = ref(false);
const proceedWithAction = async () => {
  processing.value = true;
  try {
    const verdict = pendingAction.value === 'finalize' ? 'completed' : 'rejected';
    const response = await fetch(`${API_URL}/api/verification-steps/submit-assessment/${reference.value.id}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ final_remarks: verificationReportJson.value, verdict })
    });
    if (!response.ok) {
      throw new Error('Failed to submit assessment');
    }
    if (verdict === 'completed') {
      const data = await response.json();
      if (data.pdfUrl) {
        window.open(data.pdfUrl, '_blank');
      } else {
        console.error('No PDF URL found');
      }
    }
    router.push('/staff/dashboard');
  } catch (error) {
    console.error('Error submitting assessment:', error);
  } finally {
    processing.value = false;
    showConfirmationModal.value = false
    pendingAction.value = null
  }
}

const cancelAction = () => {
  showConfirmationModal.value = false
  pendingAction.value = null
}

// Gather all step decisions into JSON format
const verificationReportJson = computed(() => {
  const report: any = {}

  // Step 1: ID_SELFIE
  const step1 = steps.value[0]
  if (step1) {
    report['id'] = {
      decision: step1.overall_pass === true ? 'PASS' : step1.overall_pass === false ? 'FAIL' : 'PENDING',
      notes: step1.notes || '',
      Verification_Checks: {},
      Evidence_Sources_Used: step1.evidence_sources || []
    }
  }

  // Step 2: RTR_VERIFICATION
  const step2 = steps.value[1]
  if (step2) {
    report['rtr'] = {
      decision: step2.overall_pass === true ? 'PASS' : step2.overall_pass === false ? 'FAIL' : 'PENDING',
      notes: step2.notes || '',
      Verification_Checks: {},
      Evidence_Sources_Used: step2.evidence_sources || []
    }
  }

  // Step 3: INCOME_AFFORDABILITY
  const step3 = steps.value[2]
  if (step3) {
    const decision = step3.status === 'GUARANTOR_NEEDED' ? 'GUARANTOR_NEEDED' :
      step3.overall_pass === true ? 'PASS' : step3.overall_pass === false ? 'FAIL' : 'PENDING'
    report['income'] = {
      decision,
      notes: step3.notes || '',
      Verification_Checks: step3.checks.reduce((acc: any, check: any) => {
        acc[check.name] = check.pass === true ? 'PASS' : check.pass === false ? 'FAIL' : null
        return acc
      }, {}),
      Evidence_Sources_Used: step3.evidence_sources || []
    }
  }

  // Step 4: RESIDENTIAL
  const step4 = steps.value[3]
  if (step4) {
    const decision = step4.status === 'amber' ? 'AMBER' :
      step4.overall_pass === true ? 'PASS' : step4.overall_pass === false ? 'FAIL' : 'PENDING'
    report['residential'] = {
      decision,
      notes: step4.notes || '',
      Verification_Checks: step4.checks.reduce((acc: any, check: any) => {
        acc[check.name] = check.pass === true ? 'PASS' : check.pass === false ? 'FAIL' : null
        return acc
      }, {}),
      Evidence_Sources_Used: step4.evidence_sources || []
    }
  }

  // Step 5: CREDIT_TAS
  const step5 = steps.value[4]
  if (step5) {
    report['credit_tas'] = {
      decision: step5.overall_pass === true ? 'PASS' : step5.overall_pass === false ? 'FAIL' : 'PENDING',
      notes: step5.notes || '',
      tas_category: tasDecision.value || null,
      tas_reason: tasReason.value || '',
      Verification_Checks: step5.checks.reduce((acc: any, check: any) => {
        acc[check.name] = check.pass === true ? 'PASS' : check.pass === false ? 'FAIL' : null
        return acc
      }, {}),
      Evidence_Sources_Used: step5.evidence_sources || []
    }
  }

  return report
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
    const downloadUrl = `${API_URL}/api/staff/download/${referenceId}/${folder}/${encodeURIComponent(filename)}`

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

// Check if a blob URL is a PDF by examining its MIME type
const checkIfPdf = async (url: string): Promise<boolean> => {
  if (!url || !url.startsWith('blob:')) return false
  try {
    const response = await fetch(url)
    const blob = await response.blob()
    return blob.type === 'application/pdf'
  } catch {
    return false
  }
}

const previewPayslip = async (filePath: string, index: number) => {
  selectedPayslipIndex.value = index
  payslipPreviewUrl.value = await loadImageAsBlob(filePath)
}

const clearPayslipPreview = () => {
  selectedPayslipIndex.value = null
  payslipPreviewUrl.value = ''
}

const previewTaxReturn = async (filePath: string) => {
  taxReturnPreviewUrl.value = await loadImageAsBlob(filePath)
}

const clearTaxReturnPreview = () => {
  taxReturnPreviewUrl.value = ''
}

const previewProofOfFunds = async (filePath: string) => {
  proofOfFundsPreviewUrl.value = await loadImageAsBlob(filePath)
}

const clearProofOfFundsPreview = () => {
  proofOfFundsPreviewUrl.value = ''
}

const previewProofOfAdditionalIncome = async (filePath: string) => {
  proofOfAdditionalIncomePreviewUrl.value = await loadImageAsBlob(filePath)
}

const clearProofOfAdditionalIncomePreview = () => {
  proofOfAdditionalIncomePreviewUrl.value = ''
}

// Staff document upload function
const handleStaffUpload = async (event: Event, documentType: string) => {
  const input = event.target as HTMLInputElement
  if (!input.files || !input.files[0]) return

  const file = input.files[0]
  uploadingDocument.value = true

  try {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('document_type', documentType)

    const response = await fetch(`${API_URL}/api/staff/references/${reference.value.id}/upload-document`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`
      },
      body: formData
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to upload document')
    }

    // Reload the reference data to show the newly uploaded document
    await loadData()
    toast.success('Document uploaded successfully')
  } catch (err: any) {
    toast.error(err.message || 'Failed to upload document')
  } finally {
    uploadingDocument.value = false
    input.value = '' // Reset file input
  }
}

// Open request document modal
const openRequestDocumentModal = (documentType: string) => {
  requestDocumentType.value = documentType
  requestDocumentMessage.value = ''
  showRequestDocumentModal.value = true
}

// Send document request to tenant (pushes back to in_progress)
const sendDocumentRequest = async () => {
  if (!requestDocumentType.value) return

  requestDocumentLoading.value = true

  try {
    const response = await fetch(`${API_URL}/api/staff/references/${reference.value.id}/request-document`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        document_type: requestDocumentType.value,
        message: requestDocumentMessage.value
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to send document request')
    }

    const result = await response.json()
    toast.success(result.message)
    showRequestDocumentModal.value = false

    // Navigate back to work queue since reference is now in_progress
    router.push('/staff/work-queue')
  } catch (err: any) {
    toast.error(err.message || 'Failed to send document request')
  } finally {
    requestDocumentLoading.value = false
  }
}

type DomainScores = {
  aml: number | null
  rtr: number | null
  credit: number | null
  income: number | null
  residential: number | null
  checked_at: string | null
  income_band: '3x' | '2.5x' | 'below_2.5x' | null
}
const credit_status = ref<string | null>(null);

// Score data
const riskScore = ref<number | null>(null)
const systemDecision = ref<string | null>(null)
const domainScores = ref<DomainScores>({
  aml: null,
  rtr: null,
  credit: null,
  income: null,
  residential: null,
  checked_at: null,
  income_band: null
})
interface ReassesmentDataForPreview {
  domains: DomainScores,
  decision: string | null,
  risk_score: number | null,
  risk_level: string | null
  gates: any[]
}
const reassesmentDataForPreview = ref<ReassesmentDataForPreview>({
  domains: {
    aml: null,
    rtr: null,
    credit: null,
    income: null,
    income_band: null,
    residential: null,
    checked_at: null
  },
  decision: null,
  risk_score: null,
  risk_level: null,
  gates: []
})

// Methods
const loadData = async () => {
  try {
    loading.value = true
    error.value = null

    const referenceId = route.params.id as string
    workItemId.value = route.query.workItemId as string || null

    // Load reference data
    const refResponse = await fetch(`${API_URL}/api/staff/references/${referenceId}`, {
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
    landlordReference.value = refData.landlordReference || null
    agentReference.value = refData.agentReference || null
    employerReference.value = refData.employerReference || null
    accountantReference.value = refData.accountantReference || null
    guarantorReference.value = refData.guarantorReference || null
    previousAddresses.value = refData.previousAddresses || []
    credit_status.value = refData?.score?.risk_level ?? null


    // Bind score data
    riskScore.value = refData?.score?.score_total ?? null
    systemDecision.value = refData?.score?.decision ?? null

    // Bind domain scores
    if (refData?.score?.domain_scores) {
      domainScores.value = {
        aml: refData.score.domain_scores.aml ?? null,
        rtr: refData.score.domain_scores.rtr ?? null,
        credit: refData.score.domain_scores.credit ?? null,
        income: refData.score.domain_scores.income ?? null,
        residential: refData.score.domain_scores.residential ?? null,
        checked_at: refData.score.scored_at ?? null,
        income_band: (refData.score.ratio >= 3) ? '3x' : (refData.score.ratio >= 2.5) ? '2.5x' : 'below_2.5x'
      }
    }

    // Bind gates from caps array
    if (Array.isArray(refData?.score?.caps)) {
      previewGates.value = previewGates.value.map(gate => ({
        ...gate,
        active: refData.score.caps.includes(gate.key)
      }))
    }

    let flags = {}
    try {
      flags = JSON.parse(refData.creditsafeVerification?.fraud_indicators ?? '{}')
    } catch (err: any) {
      console.error('Error parsing fraud indicators:', err)
    }

    const areSanctionClear = refData?.sanctionsScreening?.risk_level === 'clear' || (Array.isArray(refData?.sanctionsScreening?.sanctions_matches) && refData?.sanctionsScreening?.sanctions_matches.length === 0)

    creditAndAmlVerification.value = {
      verification: {
        name_match_score: refData.creditsafeVerification?.name_match_score ?? 0,
        application_status: refData?.score?.decision,
        risk_level: refData?.score?.risk_level,
        risk_score: refData?.score?.score_total ?? 0,
        verification_flags: flags as any
      },
      complianceChecks: {
        pep: areSanctionClear,
        sanctions: areSanctionClear,
        adverseMedia: areSanctionClear
      } as any
    }

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

    // Load proof of address preview (for residential step)
    if (reference.value.proof_of_address_path) {
      console.log('Loading proof of address from path:', reference.value.proof_of_address_path)
      proofOfAddressBlobUrl.value = await loadImageAsBlob(reference.value.proof_of_address_path)
      proofOfAddressIsPdf.value = await checkIfPdf(proofOfAddressBlobUrl.value)
    } else {
      console.warn('No proof of address path found')
    }

    // Load RTR alternative document (for RTR verification step)
    if (reference.value.rtr_alternative_document_path) {
      console.log('Loading RTR alternative document from path:', reference.value.rtr_alternative_document_path)
      rtrAlternativeDocumentBlobUrl.value = await loadImageAsBlob(reference.value.rtr_alternative_document_path)
      rtrAlternativeDocumentIsPdf.value = await checkIfPdf(rtrAlternativeDocumentBlobUrl.value)
    } else {
      console.warn('No RTR alternative document path found')
    }


    // Load evidence source options
    const evidenceResponse = await fetch(`${API_URL}/api/verification-steps/evidence-sources`, {
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

  } catch (err: any) {
    error.value = err.message
    console.error('Error loading verification data:', err)
  } finally {
    loading.value = false
  }
}

const nextStep = () => {
  if (currentStep.value < 6) {
    currentStep.value++
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

const previousStep = () => {
  if (currentStep.value > 1) {
    currentStep.value--
  }
}


const handleSignOut = async () => {
  await authStore.signOut()
  router.push('/staff/login')
}

// Helper functions for verification checks for income & affordability
const toggleCheck = (checkName: string, pass: boolean) => {
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
// Helper functions for income & affordability verification checks
const getCheckValue = (checkName: string): boolean | null => {
  const currentChecks = steps.value[2]!.checks as any[]
  const check = currentChecks.find((c: any) => c.name === checkName)
  return check ? check.pass : null
}

// Helper functions for residential verification checks
const toggleResidentialCheck = (checkName: string, pass: boolean) => {
  const currentChecks = steps.value[3]!.checks as any[]
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

// Helper functions for residential verification checks
const getResidentialCheckValue = (checkName: string): boolean | null => {
  const currentChecks = steps.value[3]!.checks as any[]
  const check = currentChecks.find((c: any) => c.name === checkName)
  return check ? check.pass : null
}

const formatDate = (value?: string | null, fallback = 'N/A') =>
  formatUkDate(
    value,
    {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    },
    fallback
  )

// Re-assessment API call
const buildReAssessmentPayload = () => {
  // Map step 2 (RTR) to rtr_verified
  const step2 = steps.value[1]

  const rtr_verified = step2?.overall_pass === true
  // Map step 3 (Income & Affordability) to financial_status
  const step3 = steps.value[2]
  let financial_status: 'PASS' | 'FAIL' | 'GUARANTOR_NEEDED' = 'FAIL'
  if (step3?.status === 'GUARANTOR_NEEDED') {
    // For guarantor needed, we'll use FAIL as per GlobalStatus type
    financial_status = 'GUARANTOR_NEEDED'
  } else if (step3?.overall_pass === true) {
    financial_status = 'PASS'
  } else if (step3?.overall_pass === false) {
    financial_status = 'FAIL'
  }

  // Map step 4 (Residential) to res_assessment_status
  const step4 = steps.value[3]
  let res_assessment_status: 'PASS' | 'SKIPPED' | 'FAIL' | 'AMBER' = 'FAIL'
  if (step4?.status === 'amber') {
    res_assessment_status = 'AMBER'
  } else if (step4?.overall_pass === true) {
    res_assessment_status = 'PASS'
  } else if (step4?.overall_pass === false) {
    res_assessment_status = 'FAIL'
  } else if (reference.value?.reference_type === 'living_with_family') {
    res_assessment_status = 'SKIPPED'
  }

  const step5 = steps.value[4]
  // Map credit flags from creditAndAmlVerification
  // Electoral roll is a factual check from creditsafe - always use actual value
  // Insolvency/CCJ are overridden by staff decision when TAS is not REFER
  const credit_flags = {
    insolvency: tasDecision.value !== 'REFER' ? !step5?.overall_pass : creditAndAmlVerification.value?.verification?.verification_flags?.insolvencyMatch,
    ccj: tasDecision.value !== 'REFER' ? !step5?.overall_pass : creditAndAmlVerification.value?.verification?.verification_flags?.ccjMatch,
    deceased: creditAndAmlVerification.value?.verification?.verification_flags?.deceasedMatch,
    electoral: creditAndAmlVerification.value?.verification?.verification_flags?.electoralRollMatch ?? true,
  }

  // Map sanctions_clear from complianceChecks
  const sanctions_clear = step5?.overall_pass === true

  return {
    financial_status,
    res_assessment_status,
    rtr_verified,
    credit_flags,
    sanctions_clear
  }
}

const triggerReAssessment = async () => {
  const referenceId = route.params.id as string
  if (!referenceId) {
    reAssessmentError.value = 'Reference ID not found'
    return
  }

  try {
    reAssessmentLoading.value = true
    reAssessmentError.value = null

    const payload = buildReAssessmentPayload()

    const response = await fetch(`${API_URL}/api/staff/references/${referenceId}/re-assess`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `Failed to re-assess: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    let gates: any[] = []

    if (Array.isArray(data?.result?.caps)) {
      gates = previewGates.value.map(gate => ({
        ...gate,
        active: data?.result?.caps.includes(gate.key)
      }))
    }

    reassesmentDataForPreview.value = {
      domains: {
        aml: data.result.domain_scores.aml ?? null,
        rtr: data.result.domain_scores.rtr ?? null,
        credit: data.result.domain_scores.credit ?? null,
        income: data.result.domain_scores.income ?? null,
        residential: data.result.domain_scores.residential ?? null,
        checked_at: data.result.scored_at ?? null,
        income_band: (data.result.ratio >= 3) ? '3x' : (data.result.ratio >= 2.5) ? '2.5x' : 'below_2.5x'
      },
      decision: data.result.decision,
      risk_score: data.result.score_total,
      risk_level: data.result.risk_level,
      gates
    }
  } catch (err: any) {
    reAssessmentError.value = err.message || 'Failed to re-assess application score'
    console.error('Error re-assessing application:', err)
  } finally {
    reAssessmentLoading.value = false
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

// Watch for step change to trigger re-assessment when reaching preview
watch(currentStep, (newStep) => {
  if (newStep === 6) {
    triggerReAssessment()
  }
})

// Lifecycle
onMounted(() => {
  loadData()
})
</script>

<style scoped>
/* Add any custom styles here */
</style>
