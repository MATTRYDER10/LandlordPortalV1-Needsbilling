<template>
  <div class="min-h-screen bg-slate-50 dark:bg-slate-950">
    <!-- Header -->
    <header class="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 px-6 py-4">
      <div class="max-w-4xl mx-auto">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-4">
            <button
              @click="goBack"
              class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800"
            >
              <ArrowLeft class="w-5 h-5" />
            </button>
            <div>
              <div class="flex items-center gap-2">
                <component :is="sectionIcon" class="w-6 h-6 text-primary" />
                <h1 class="text-xl font-bold text-gray-900 dark:text-white">{{ sectionTitle }} Verification</h1>
              </div>
            </div>
          </div>
          <UKTimeClock />
        </div>
      </div>
    </header>

    <!-- Loading State -->
    <div v-if="loading" class="max-w-4xl mx-auto p-6">
      <div class="bg-white dark:bg-slate-800 rounded-xl p-6 animate-pulse">
        <div class="h-6 bg-gray-200 dark:bg-slate-700 rounded w-1/3 mb-4"></div>
        <div class="h-4 bg-gray-100 dark:bg-slate-600 rounded w-1/2 mb-2"></div>
        <div class="h-4 bg-gray-100 dark:bg-slate-600 rounded w-2/3"></div>
      </div>
    </div>

    <!-- Main Content -->
    <main v-else class="max-w-4xl mx-auto p-6 space-y-6">
      <!-- Applicant Info Card -->
      <div class="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
        <div class="flex items-start justify-between">
          <div>
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ section?.tenant_name }}
            </h2>
            <p v-if="section?.reference_number" class="text-xs font-mono text-gray-400 dark:text-slate-500">
              {{ section.reference_number }}
            </p>
            <p class="text-gray-500 dark:text-slate-400 mt-1">
              {{ section?.property_address }}
            </p>
            <p class="text-sm text-gray-400 dark:text-slate-500">
              {{ section?.company_name }}
            </p>
          </div>
          <div class="text-right">
            <div class="text-lg font-semibold text-primary">£{{ section?.rent_share || section?.monthly_rent }}/mo</div>
            <div class="text-sm text-gray-500">Rent Share</div>
            <div v-if="section?.is_guarantor" class="mt-2 px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-xs rounded-full inline-block">
              Guarantor
            </div>
          </div>
        </div>

        <!-- Affordability indicator for income section -->
        <div v-if="section?.section_type === 'INCOME' && section?.affordability" class="mt-4 p-3 rounded-lg"
          :class="section.affordability.passes ? 'bg-green-50 dark:bg-green-900/20' : 'bg-amber-50 dark:bg-amber-900/20'"
        >
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium" :class="section.affordability.passes ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'">
              Affordability: {{ section.affordability.ratio.toFixed(1) }}x
            </span>
            <span class="text-sm" :class="section.affordability.passes ? 'text-green-600' : 'text-amber-600'">
              {{ section.affordability.passes ? 'Passes' : 'Below threshold' }}
            </span>
          </div>
          <p class="text-xs mt-1" :class="section.affordability.passes ? 'text-green-600/80' : 'text-amber-600/80'">
            Required: {{ section.is_guarantor ? '32x' : '30x' }} monthly rent = £{{ section.affordability.required }}/year
          </p>
        </div>
      </div>

      <!-- Tenant Submitted Data -->
      <div v-if="section?.form_data && Object.keys(section.form_data).length > 0" class="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
        <h3 class="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-4 uppercase tracking-wider">Tenant Submitted Data</h3>
        <div class="grid grid-cols-2 gap-3">
          <div v-for="(value, key) in filteredFormData" :key="key" class="text-sm"
            :class="{
              'col-span-2 mt-2 pt-2 border-t border-gray-200 dark:border-slate-700': key === 'totalDeclaredAnnualIncome',
              'bg-amber-50 dark:bg-amber-900/20 -mx-1 px-1 py-1 rounded': key === 'annualRentalIncome' || key === 'totalDeclaredAnnualIncome'
            }"
          >
            <span class="text-gray-500 dark:text-slate-400 block text-xs">{{ formatLabel(key as string) }}</span>
            <span class="font-medium" :class="key === 'totalDeclaredAnnualIncome' ? 'text-lg text-primary' : 'text-gray-900 dark:text-white'">{{ formatDisplayValue(key as string, value) }}</span>
          </div>
        </div>
      </div>

      <!-- Evidence Documents -->
      <div v-if="hasEvidence" class="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
        <h3 class="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-4 uppercase tracking-wider">Evidence & Documents</h3>

        <!-- ID & Selfie side by side for IDENTITY section -->
        <div v-if="section?.section_type === 'IDENTITY'" class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div v-if="section.evidence?.id_document" class="text-center">
              <p class="text-xs text-gray-500 mb-2 font-medium">ID Document</p>
              <img
                :src="section.evidence.id_document.url"
                alt="ID Document"
                class="w-full rounded-lg border border-gray-200 cursor-pointer hover:shadow-lg transition-shadow"
                @click="viewImage(section.evidence.id_document.url)"
              />
            </div>
            <div v-if="section.evidence?.selfie" class="text-center">
              <p class="text-xs text-gray-500 mb-2 font-medium">Selfie Photo</p>
              <img
                :src="section.evidence.selfie.url"
                alt="Selfie"
                class="w-full rounded-lg border border-gray-200 cursor-pointer hover:shadow-lg transition-shadow"
                @click="viewImage(section.evidence.selfie.url)"
              />
            </div>
          </div>
          <p class="text-xs text-gray-400 text-center">Click to enlarge. Compare selfie against ID document photo.</p>
        </div>

        <!-- RTR Evidence + Gov.uk link -->
        <div v-else-if="section?.section_type === 'RTR'" class="space-y-4">
          <div v-if="section.evidence?.rtr_document" class="text-center">
            <img
              :src="section.evidence.rtr_document.url"
              alt="Right to Rent Evidence"
              class="max-h-64 mx-auto rounded-lg border border-gray-200 cursor-pointer hover:shadow-lg transition-shadow"
              @click="viewImage(section.evidence.rtr_document.url)"
            />
            <p class="text-xs text-gray-400 mt-2">{{ section.evidence.rtr_document.filename || 'Right to Rent Document' }}</p>
          </div>
          <!-- Passport from Identity section (UK citizens using passport as RTR proof) -->
          <div v-if="section.evidence?.passport" class="text-center">
            <p class="text-xs text-gray-500 mb-2 font-medium">Passport</p>
            <img
              :src="section.evidence.passport.url"
              alt="Passport"
              class="max-h-64 mx-auto rounded-lg border border-gray-200 cursor-pointer hover:shadow-lg transition-shadow"
              @click="viewImage(section.evidence.passport.url)"
            />
            <p class="text-xs text-gray-400 mt-2">{{ section.evidence.passport.filename }}</p>
          </div>
          <!-- ID Document from Identity section -->
          <div v-if="section.evidence?.id_document_cross_ref" class="text-center">
            <p class="text-xs text-gray-500 mb-2 font-medium">ID Document</p>
            <img
              :src="section.evidence.id_document_cross_ref.url"
              alt="ID Document"
              class="max-h-64 mx-auto rounded-lg border border-gray-200 cursor-pointer hover:shadow-lg transition-shadow"
              @click="viewImage(section.evidence.id_document_cross_ref.url)"
            />
            <p class="text-xs text-gray-400 mt-2">{{ section.evidence.id_document_cross_ref.filename }}</p>
          </div>
          <!-- Move-in date reminder -->
          <div v-if="section?.reference?.move_in_date" class="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <p class="text-xs text-gray-500 mb-1">Move-in Date</p>
            <p class="font-semibold text-amber-800 dark:text-amber-300">{{ new Date(section.reference.move_in_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) }}</p>
            <p class="text-xs text-amber-600 dark:text-amber-400 mt-1">RTR must be valid until after this date</p>
          </div>

          <a
            href="https://www.gov.uk/view-right-to-rent"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-blue-700 dark:text-blue-400 hover:bg-blue-100 transition-colors text-sm font-medium"
          >
            <ExternalLink class="w-4 h-4" />
            Open Gov.uk Right to Rent Check
          </a>

          <div v-if="section.form_data?.citizenshipStatus" class="p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
            <p class="text-xs text-gray-500 mb-1">Declared Status</p>
            <p class="font-medium text-gray-900 dark:text-white">{{ formatValue(section.form_data.citizenshipStatus) }}</p>
          </div>
          <div v-if="section.form_data?.shareCode" class="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p class="text-xs text-gray-500 mb-1">Share Code</p>
            <p class="font-mono font-bold text-blue-700 dark:text-blue-400 text-lg tracking-wider">{{ section.form_data.shareCode }}</p>
            <p v-if="section.form_data?.shareCodeExpiry" class="text-xs text-gray-500 mt-1">Expires: {{ section.form_data.shareCodeExpiry }}</p>
          </div>
        </div>

        <!-- Income Evidence -->
        <div v-else-if="section?.section_type === 'INCOME'" class="space-y-3">
          <div v-if="section.evidence?.payslips" class="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
            <div class="flex items-center gap-2">
              <FileText class="w-4 h-4 text-gray-400" />
              <span class="text-sm">{{ section.evidence.payslips.filename || 'Payslips' }}</span>
            </div>
            <a :href="section.evidence.payslips.url" target="_blank" class="text-primary text-sm hover:underline">View</a>
          </div>
          <div v-if="section.evidence?.tax_return" class="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
            <div class="flex items-center gap-2">
              <FileText class="w-4 h-4 text-gray-400" />
              <span class="text-sm">{{ section.evidence.tax_return.filename || 'Tax Return / SA302' }}</span>
            </div>
            <a :href="section.evidence.tax_return.url" target="_blank" class="text-primary text-sm hover:underline">View</a>
          </div>
        </div>

        <!-- Residential Evidence -->
        <div v-else-if="section?.section_type === 'RESIDENTIAL'" class="space-y-3">
          <div v-if="section.evidence?.proof_of_address" class="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
            <div class="flex items-center gap-2">
              <FileText class="w-4 h-4 text-gray-400" />
              <span class="text-sm">{{ section.evidence.proof_of_address.filename || 'Proof of Address' }}</span>
            </div>
            <a :href="section.evidence.proof_of_address.url" target="_blank" class="text-primary text-sm hover:underline">View</a>
          </div>
        </div>

        <!-- Credit Check Results - Full Creditsafe Response -->
        <div v-else-if="section?.section_type === 'CREDIT' && section.credit_check" class="space-y-4">
          <!-- Summary -->
          <div class="grid grid-cols-3 gap-3">
            <div class="p-3 rounded-lg" :class="creditRiskColor.bg">
              <p class="text-xs text-gray-500">Creditsafe Risk Level</p>
              <p class="font-bold" :class="creditRiskColor.text">{{ creditRiskLabel }}</p>
            </div>
            <div class="p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
              <p class="text-xs text-gray-500">Risk Score</p>
              <p class="font-bold text-gray-900 dark:text-white">{{ section.credit_check.risk_score }}/100</p>
            </div>
            <div class="p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
              <p class="text-xs text-gray-500">Creditsafe Status</p>
              <p class="font-bold text-gray-900 dark:text-white capitalize">{{ section.credit_check.status }}</p>
            </div>
          </div>

          <!-- Adverse Credit Declaration -->
          <div v-if="section?.reference?.has_adverse_credit || section?.form_data?.hasAdverseCredit" class="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg">
            <div class="flex items-center gap-2 mb-1">
              <AlertCircle class="w-4 h-4 text-amber-600" />
              <p class="text-sm font-semibold text-amber-800 dark:text-amber-300">Adverse Credit Declared by Tenant</p>
            </div>
            <p v-if="section?.reference?.adverse_credit_details || adverseCreditDetails" class="text-sm text-amber-700 dark:text-amber-400 mt-1 italic">
              "{{ section?.reference?.adverse_credit_details || adverseCreditDetails }}"
            </p>
            <p class="text-xs text-amber-600 mt-2">Honesty bonus: tenant disclosed this voluntarily. Undeclared adverse credit over £500 unpaid is an automatic fail.</p>
          </div>
          <div v-else class="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <p class="text-sm text-green-700 dark:text-green-400 font-medium">No adverse credit declared by tenant</p>
            <p class="text-xs text-green-600 mt-1">If CCJs/insolvencies found below that were not declared, and value exceeds £500 unpaid — automatic fail.</p>
          </div>

          <!-- Key Checks -->
          <div v-if="creditResponseData" class="space-y-2">
            <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Verification Results</h4>
            <div class="grid grid-cols-2 gap-2 text-sm">
              <div class="flex justify-between p-2.5 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                <span class="text-gray-600">Identity Verified</span>
                <span :class="creditResponseData.verifyMatch ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'">{{ creditResponseData.verifyMatch ? 'Yes' : 'No' }}</span>
              </div>
              <div class="flex justify-between p-2.5 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                <span class="text-gray-600">Electoral Roll</span>
                <span :class="creditResponseData.electoralRegisterMatch ? 'text-green-600 font-semibold' : 'text-amber-600 font-semibold'">{{ creditResponseData.electoralRegisterMatch ? 'Found' : 'Not Found' }}</span>
              </div>
              <div class="flex justify-between p-2.5 rounded-lg" :class="creditResponseData.ccjMatch ? 'bg-red-50 dark:bg-red-900/20' : 'bg-green-50 dark:bg-green-900/20'">
                <span class="text-gray-600">CCJ Check</span>
                <span :class="creditResponseData.ccjMatch ? 'text-red-600 font-bold' : 'text-green-600 font-semibold'">{{ creditResponseData.ccjMatch ? `FAIL (${creditResponseData.countyCourtJudgments?.length || 0} found)` : 'PASS' }}</span>
              </div>
              <div class="flex justify-between p-2.5 rounded-lg" :class="creditResponseData.insolvencyMatch ? 'bg-red-50 dark:bg-red-900/20' : 'bg-green-50 dark:bg-green-900/20'">
                <span class="text-gray-600">Insolvency Check</span>
                <span :class="creditResponseData.insolvencyMatch ? 'text-red-600 font-bold' : 'text-green-600 font-semibold'">{{ creditResponseData.insolvencyMatch ? `FAIL (${creditResponseData.insolvencies?.length || 0} found)` : 'PASS' }}</span>
              </div>
              <div class="flex justify-between p-2.5 rounded-lg" :class="creditResponseData.deceasedRegisterMatch ? 'bg-red-50' : 'bg-green-50'">
                <span class="text-gray-600">Deceased Register</span>
                <span :class="creditResponseData.deceasedRegisterMatch ? 'text-red-600 font-bold' : 'text-green-600 font-semibold'">{{ creditResponseData.deceasedRegisterMatch ? 'MATCH' : 'Clear' }}</span>
              </div>
              <div class="flex justify-between p-2.5 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                <span class="text-gray-600">Checked At</span>
                <span class="text-gray-900 dark:text-white">{{ formatUKDateTime(section.credit_check.created_at) }}</span>
              </div>
            </div>
          </div>

          <!-- CCJ Details (if any found) -->
          <div v-if="creditResponseData?.countyCourtJudgments?.length > 0" class="space-y-2">
            <h4 class="text-xs font-semibold text-red-600 uppercase tracking-wider">CCJ Details</h4>
            <div v-for="(ccj, idx) in creditResponseData.countyCourtJudgments" :key="idx" class="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm">
              <div class="grid grid-cols-2 gap-2">
                <div><span class="text-gray-500">Court:</span> <span class="font-medium">{{ ccj.courtName || 'Unknown' }}</span></div>
                <div><span class="text-gray-500">Amount:</span> <span class="font-medium">£{{ ccj.amount || 'Unknown' }}</span></div>
                <div><span class="text-gray-500">Date:</span> <span class="font-medium">{{ ccj.dateOfJudgment || ccj.registrationDate || 'Unknown' }}</span></div>
                <div><span class="text-gray-500">Status:</span> <span class="font-medium" :class="ccj.caseStatus === 'Satisfied' ? 'text-green-600' : 'text-red-600'">{{ ccj.caseStatus || 'Unknown' }}</span></div>
              </div>
            </div>
          </div>

          <!-- Insolvency Details (if any found) -->
          <div v-if="creditResponseData?.insolvencies?.length > 0" class="space-y-2">
            <h4 class="text-xs font-semibold text-red-600 uppercase tracking-wider">Insolvency Details</h4>
            <div v-for="(ins, idx) in creditResponseData.insolvencies" :key="idx" class="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm">
              <div class="grid grid-cols-2 gap-2">
                <div><span class="text-gray-500">Type:</span> <span class="font-medium">{{ ins.type || ins.caseType || 'Unknown' }}</span></div>
                <div><span class="text-gray-500">Date:</span> <span class="font-medium">{{ ins.date || ins.startDate || 'Unknown' }}</span></div>
                <div><span class="text-gray-500">Status:</span> <span class="font-medium">{{ ins.status || 'Unknown' }}</span></div>
              </div>
            </div>
          </div>

          <!-- Electoral Roll Details -->
          <div v-if="creditResponseData?.electoralRolls?.length > 0" class="space-y-2">
            <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Electoral Roll Records</h4>
            <div v-for="(er, idx) in creditResponseData.electoralRolls" :key="idx" class="p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg text-sm">
              <div class="grid grid-cols-2 gap-2">
                <div v-if="er.address"><span class="text-gray-500">Address:</span> <span class="font-medium">{{ er.address }}</span></div>
                <div v-if="er.dateOfRegistration"><span class="text-gray-500">Registered:</span> <span class="font-medium">{{ er.dateOfRegistration }}</span></div>
              </div>
            </div>
          </div>

          <!-- Raw Creditsafe Transaction -->
          <div class="p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
            <p class="text-xs text-gray-400">Transaction ID: {{ section.credit_check.transaction_id || 'N/A' }}</p>
            <p v-if="section.credit_check.address_type" class="text-xs text-gray-400 mt-1">Address: {{ section.credit_check.address_type === 'previous' ? 'Previous' : 'Current' }}</p>
          </div>

          <!-- Previous Address Credit Check -->
          <div v-if="previousAddressCreditCheck" class="border border-indigo-200 dark:border-indigo-800 rounded-xl overflow-hidden">
            <div class="px-4 py-3 bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-200 dark:border-indigo-800">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <CreditCard class="w-4 h-4 text-indigo-600" />
                  <span class="font-semibold text-indigo-800 dark:text-indigo-300 text-sm">Previous Address Credit Check</span>
                </div>
                <span class="text-xs px-2 py-0.5 rounded-full font-medium"
                  :class="previousAddressCreditCheck.risk_level === 'low' ? 'bg-green-100 text-green-700' : previousAddressCreditCheck.risk_level === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'"
                >{{ previousAddressCreditCheck.risk_level || previousAddressCreditCheck.status }}</span>
              </div>
              <p v-if="previousAddressCreditCheck.requestData" class="text-xs text-indigo-600 mt-1">
                {{ previousAddressCreditCheck.requestData.address }}, {{ previousAddressCreditCheck.requestData.postcode }}
              </p>
            </div>
            <div class="p-4 space-y-2">
              <div class="grid grid-cols-3 gap-3 text-sm">
                <div class="p-2.5 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                  <p class="text-xs text-gray-500">Risk Score</p>
                  <p class="font-bold text-gray-900 dark:text-white">{{ previousAddressCreditCheck.risk_score }}/100</p>
                </div>
                <div class="p-2.5 rounded-lg" :class="previousAddressCreditCheck.responseData?.ccjMatch ? 'bg-red-50' : 'bg-green-50'">
                  <p class="text-xs text-gray-500">CCJs</p>
                  <p :class="previousAddressCreditCheck.responseData?.ccjMatch ? 'font-bold text-red-600' : 'font-semibold text-green-600'">
                    {{ previousAddressCreditCheck.responseData?.ccjMatch ? `${previousAddressCreditCheck.responseData?.countyCourtJudgments?.length || 0} found` : 'Clear' }}
                  </p>
                </div>
                <div class="p-2.5 rounded-lg" :class="previousAddressCreditCheck.responseData?.insolvencyMatch ? 'bg-red-50' : 'bg-green-50'">
                  <p class="text-xs text-gray-500">Insolvency</p>
                  <p :class="previousAddressCreditCheck.responseData?.insolvencyMatch ? 'font-bold text-red-600' : 'font-semibold text-green-600'">
                    {{ previousAddressCreditCheck.responseData?.insolvencyMatch ? 'Found' : 'Clear' }}
                  </p>
                </div>
              </div>
              <!-- Previous address CCJ details -->
              <div v-if="previousAddressCreditCheck.responseData?.countyCourtJudgments?.length > 0" class="mt-2">
                <h4 class="text-xs font-semibold text-red-600 uppercase tracking-wider mb-1">Previous Address CCJs</h4>
                <div v-for="(ccj, idx) in previousAddressCreditCheck.responseData.countyCourtJudgments" :key="idx" class="p-2 bg-red-50 dark:bg-red-900/20 rounded text-xs">
                  <span class="font-medium">{{ ccj.courtName || 'Unknown' }}</span> — £{{ ccj.amount || '?' }} ({{ ccj.caseStatus || 'Unknown' }})
                </div>
              </div>
              <p class="text-xs text-gray-400">Transaction ID: {{ previousAddressCreditCheck.transaction_id || 'N/A' }} | Checked: {{ formatUKDateTime(previousAddressCreditCheck.created_at) }}</p>
            </div>
          </div>

          <!-- Creditsafe Re-Run Panel -->
          <div class="border border-blue-200 dark:border-blue-800 rounded-xl overflow-hidden">
            <button
              @click="showCreditRerun = !showCreditRerun"
              class="w-full flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
            >
              <div class="flex items-center gap-2">
                <CreditCard class="w-5 h-5 text-blue-600" />
                <span class="font-semibold text-blue-800 dark:text-blue-300">Re-Run Creditsafe Check</span>
              </div>
              <ChevronDown class="w-4 h-4 text-blue-500 transition-transform" :class="{ 'rotate-180': showCreditRerun }" />
            </button>

            <div v-if="showCreditRerun" class="p-4 space-y-4 bg-white dark:bg-slate-800">
              <!-- What Creditsafe received -->
              <div>
                <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Data Sent to Creditsafe</h4>
                <div class="grid grid-cols-2 gap-2 text-sm">
                  <div class="p-2.5 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                    <span class="text-gray-500 text-xs">First Name</span>
                    <p class="font-medium text-gray-900 dark:text-white">{{ section.credit_check.requestData?.firstName || 'N/A' }}</p>
                  </div>
                  <div class="p-2.5 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                    <span class="text-gray-500 text-xs">Last Name</span>
                    <p class="font-medium text-gray-900 dark:text-white">{{ section.credit_check.requestData?.lastName || 'N/A' }}</p>
                  </div>
                  <div class="p-2.5 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                    <span class="text-gray-500 text-xs">Date of Birth</span>
                    <p class="font-medium text-gray-900 dark:text-white">{{ section.credit_check.requestData?.dateOfBirth || 'N/A' }}</p>
                  </div>
                  <div class="col-span-2 p-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <span class="text-amber-600 dark:text-amber-400 text-xs font-semibold">Address (as sent to Creditsafe)</span>
                    <p class="font-mono font-medium text-gray-900 dark:text-white mt-0.5">{{ section.credit_check.requestData?.address || 'N/A' }}</p>
                  </div>
                  <div class="p-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <span class="text-amber-600 dark:text-amber-400 text-xs font-semibold">Postcode (as sent)</span>
                    <p class="font-mono font-medium text-gray-900 dark:text-white mt-0.5">{{ section.credit_check.requestData?.postcode || 'N/A' }}</p>
                  </div>
                </div>
              </div>

              <!-- Proof of Address cross-reference -->
              <div v-if="section.proof_of_address_for_credit" class="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <FileText class="w-4 h-4 text-blue-500" />
                    <div>
                      <p class="text-sm font-medium text-blue-800 dark:text-blue-300">Proof of Address</p>
                      <p class="text-xs text-blue-600 dark:text-blue-400">Compare with address sent to Creditsafe</p>
                    </div>
                  </div>
                  <a :href="section.proof_of_address_for_credit.url" target="_blank" class="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 dark:bg-blue-800 dark:text-blue-300 font-medium">
                    View Document
                  </a>
                </div>
              </div>
              <div v-else class="p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                <p class="text-xs text-gray-400">No proof of address uploaded yet</p>
              </div>

              <!-- Re-run button -->
              <div class="flex items-center gap-3">
                <button
                  @click="rerunCreditCheck()"
                  :disabled="creditRerunLoading"
                  class="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium text-sm"
                >
                  <RefreshCcw v-if="!creditRerunLoading" class="w-4 h-4" />
                  <RefreshCcw v-else class="w-4 h-4 animate-spin" />
                  {{ creditRerunLoading ? 'Running...' : 'Re-Run Creditsafe Check' }}
                </button>
                <p class="text-xs text-gray-400">Uses the same name/address/DOB shown above. Page will refresh with new results.</p>
              </div>

              <!-- Raw Response Data (collapsible) -->
              <div v-if="creditResponseData?.rawResponse || section.credit_check.responseData">
                <button
                  @click="showRawCreditData = !showRawCreditData"
                  class="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
                >
                  <ChevronDown class="w-3 h-3 transition-transform" :class="{ 'rotate-180': showRawCreditData }" />
                  {{ showRawCreditData ? 'Hide' : 'Show' }} Raw Creditsafe Response
                </button>
                <div v-if="showRawCreditData" class="mt-2 p-3 bg-slate-900 rounded-lg overflow-x-auto">
                  <pre class="text-xs text-green-400 font-mono whitespace-pre-wrap">{{ JSON.stringify(creditResponseData?.rawResponse || section.credit_check.responseData, null, 2) }}</pre>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- AML Results -->
        <div v-else-if="section?.section_type === 'AML' && section.aml_check" class="space-y-3">
          <div class="p-3 rounded-lg" :class="section.aml_check.risk_level === 'clear' ? 'bg-green-50' : section.aml_check.risk_level === 'low' ? 'bg-green-50' : 'bg-red-50'">
            <p class="text-xs text-gray-500">Risk Level</p>
            <p class="font-bold capitalize" :class="section.aml_check.risk_level === 'clear' || section.aml_check.risk_level === 'low' ? 'text-green-700' : 'text-red-700'">{{ section.aml_check.risk_level }}</p>
          </div>
          <div class="text-sm space-y-1">
            <div class="flex justify-between"><span class="text-gray-500">Sanctions Matches</span><span>{{ section.aml_check.sanctions_matches || 0 }}</span></div>
            <div class="flex justify-between"><span class="text-gray-500">Donation Matches</span><span>{{ section.aml_check.donation_matches || 0 }}</span></div>
            <p v-if="section.aml_check.summary" class="text-gray-600 italic mt-2">{{ section.aml_check.summary }}</p>
          </div>
        </div>

        <!-- Generic evidence for other sections -->
        <div v-else class="space-y-3">
          <div v-for="(doc, key) in section?.evidence" :key="key" class="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
            <div class="flex items-center gap-2">
              <FileText class="w-4 h-4 text-gray-400" />
              <span class="text-sm">{{ doc.filename || key }}</span>
            </div>
            <a :href="doc.url" target="_blank" class="text-primary text-sm hover:underline">View</a>
          </div>
        </div>
      </div>

      <!-- Referee Response (if available) -->
      <div v-if="section?.verbalReference || section?.hasVerbalReference" class="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
        <h3 class="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-4 uppercase tracking-wider">Referee Response</h3>
        <div v-if="section.verbalReference" class="space-y-2 text-sm">
          <div v-for="(value, key) in section.verbalReference.responses" :key="key" class="flex justify-between">
            <span class="text-gray-500">{{ formatLabel(key as string) }}</span>
            <span class="text-gray-900 dark:text-white">{{ value }}</span>
          </div>
        </div>
      </div>

      <!-- Checklist -->
      <div class="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
        <SectionChecklist
          :steps="checklistSteps"
          @view-image="viewImage"
          @step-complete="onStepComplete"
          @issue-reported="onIssueReported"
          @all-complete="onAllStepsComplete"
        />
      </div>

      <!-- Decision Panel -->
      <div class="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
        <DecisionPanel
          :section-type="section?.section_type || ''"
          :submitting="submitting"
          @submit="submitDecision"
          @release="releaseToQueue"
        />
      </div>
    </main>

    <!-- Image Viewer Modal -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition ease-out duration-200"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition ease-in duration-150"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="viewingImage"
          class="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
          @click="viewingImage = null"
        >
          <button
            class="absolute top-4 right-4 p-2 text-white/80 hover:text-white"
            @click="viewingImage = null"
          >
            <X class="w-8 h-8" />
          </button>
          <img
            :src="viewingImage"
            class="max-w-full max-h-full object-contain"
            @click.stop
          />
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import UKTimeClock from './components/UKTimeClock.vue'
import SectionChecklist from './components/SectionChecklist.vue'
import DecisionPanel from './components/DecisionPanel.vue'
import {
  ArrowLeft,
  X,
  IdCard,
  Home,
  Briefcase,
  Building2,
  CreditCard,
  Shield,
  FileText,
  ExternalLink,
  AlertCircle,
  ChevronDown,
  RefreshCcw
} from 'lucide-vue-next'

const API_URL = import.meta.env.VITE_API_URL ?? ''
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const loading = ref(true)
const submitting = ref(false)
const section = ref<any>(null)
const viewingImage = ref<string | null>(null)
const collectedInputValues = ref<Record<string, any>>({})
const showCreditRerun = ref(false)
const showRawCreditData = ref(false)
const creditRerunLoading = ref(false)

const sectionId = computed(() => route.params.sectionId as string)

const hasEvidence = computed(() => {
  return section.value?.evidence && Object.keys(section.value.evidence).length > 0
    || section.value?.credit_check
    || section.value?.aml_check
    || section.value?.section_type === 'RTR'
})

const filteredFormData = computed(() => {
  if (!section.value?.form_data) return {}
  const skip = ['selfieUrl', 'idDocumentUrl', 'passportDocUrl', 'alternativeDocUrl', 'supportingDocUrl',
    'proofOfAddressUrl', 'payslipsUrl', 'taxReturnUrl', 'studentDocUrl', 'savingsDocUrl', 'pensionDocUrl', 'rentalDocUrl',
    'benefitsDocUrl', 'bankStatementsUrl', 'accountsDocUrl', 'otherDocUrl',
    'signature', 'proofOfAddress',
    'selfie', 'idDocument', 'passportDoc', 'alternativeDoc', 'supportingDoc', 'taxReturn', 'studentDoc']
  const result: Record<string, any> = {}
  for (const [key, value] of Object.entries(section.value.form_data)) {
    if (skip.includes(key)) continue
    if (key.endsWith('Url') || key.endsWith('Doc')) continue // catch-all for document URL fields
    if (value === null || value === undefined || value === '') continue
    if (typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'))) continue // skip raw URLs

    // Flatten currentAddress object into readable string
    if (key === 'currentAddress' && typeof value === 'object' && !Array.isArray(value)) {
      const addr = value as Record<string, any>
      const parts = [addr.line1, addr.line2, addr.city, addr.postcode].filter(Boolean)
      if (parts.length > 0) result['Current Address'] = parts.join(', ')
      continue
    }

    // Flatten previousAddresses array
    if (key === 'previousAddresses' && Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const prev = value[i] as Record<string, any>
        const addrParts = [prev.line1, prev.line2, prev.city, prev.postcode].filter(Boolean)
        if (addrParts.length > 0) result[`Previous Address ${i + 1}`] = addrParts.join(', ')
        if (prev.landlordName) result[`Previous Landlord ${i + 1}`] = prev.landlordName
        if (prev.landlordEmail) result[`Previous Landlord Email ${i + 1}`] = prev.landlordEmail
        if (prev.landlordType) result[`Landlord Type ${i + 1}`] = prev.landlordType
        if (prev.yearsAtAddress || prev.monthsAtAddress) {
          result[`Time at Address ${i + 1}`] = [prev.yearsAtAddress ? `${prev.yearsAtAddress}yr` : '', prev.monthsAtAddress ? `${prev.monthsAtAddress}mo` : ''].filter(Boolean).join(' ')
        }
      }
      continue
    }

    // Skip other nested objects
    if (typeof value === 'object' && !Array.isArray(value)) continue
    result[key] = value
  }

  // Add computed annual rental income if monthly rental exists
  const fd = section.value.form_data
  if (fd.rentalIncome && !isNaN(parseFloat(fd.rentalIncome))) {
    const monthlyRental = parseFloat(fd.rentalIncome)
    result['annualRentalIncome'] = monthlyRental * 12
  }

  // Add total confirmed income summary for INCOME section
  if (section.value.section_type === 'INCOME') {
    const salary = parseFloat(fd.annualSalary || fd.calculatedAnnualIncome || 0) || 0
    const rentalAnnual = (parseFloat(fd.rentalIncome || 0) || 0) * 12
    const selfEmployed = parseFloat(fd.selfEmployedAnnualIncome || 0) || 0
    const benefits = (parseFloat(fd.benefitsMonthlyAmount || 0) || 0) * 12
    const pension = (parseFloat(fd.pensionMonthlyAmount || 0) || 0) * 12
    const savings = parseFloat(fd.savingsAmount || 0) || 0
    const total = salary + rentalAnnual + selfEmployed + benefits + pension + savings
    if (total > 0) {
      result['totalDeclaredAnnualIncome'] = total
    }
  }

  return result
})

const labelMap: Record<string, string> = {
  firstName: 'First Name', lastName: 'Last Name', phone: 'Phone', dateOfBirth: 'Date of Birth',
  documentType: 'Document Type', citizenshipStatus: 'Citizenship Status', noPassport: 'No Passport',
  shareCode: 'Share Code', sources: 'Income Sources', jobTitle: 'Job Title', annualSalary: 'Annual Salary',
  employerName: 'Employer', employerAddress: 'Employer Address', employmentStartDate: 'Start Date',
  employerRefName: 'Employer Ref Name', employerRefEmail: 'Employer Ref Email',
  selfEmployedBusinessName: 'Business Name', selfEmployedNature: 'Nature of Business',
  selfEmployedAnnualIncome: 'Annual Income', selfEmployedStartDate: 'Business Start Date',
  hourlyRate: 'Hourly Rate', hoursPerWeek: 'Hours Per Week', payFrequency: 'Pay Frequency',
  payType: 'Pay Type', calculatedAnnualIncome: 'Calculated Annual Income',
  accountantName: 'Accountant', accountantEmail: 'Accountant Email', accountantPhone: 'Accountant Phone',
  benefitsMonthlyAmount: 'Monthly Benefits', savingsAmount: 'Savings', pensionMonthlyAmount: 'Monthly Pension',
  rentalIncome: 'Monthly Rental Income', annualRentalIncome: 'Annual Rental Income (x12)',
  totalDeclaredAnnualIncome: 'Total Declared Annual Income',
  rentalProperties: 'Number of Rental Properties',
  currentLivingSituation: 'Living Situation', currentLandlordName: 'Current Landlord',
  currentLandlordEmail: 'Landlord Email', currentLandlordPhone: 'Landlord Phone',
  smoker: 'Smoker', hasPets: 'Has Pets', petDetails: 'Pet Details',
  maritalStatus: 'Marital Status', dependants: 'Dependants', hasAdverseCredit: 'Adverse Credit',
  adverseCreditDetails: 'Adverse Credit Details', university: 'University', course: 'Course'
}

function formatLabel(key: string): string {
  return labelMap[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim()
}

const valueMap: Record<string, string> = {
  'uk_citizen': 'UK Citizen',
  'BRITISH_CITIZEN': 'British Citizen',
  'eu_settled': 'EU Settled Status',
  'EU_SETTLED': 'EU Settled Status',
  'eu_pre_settled': 'EU Pre-Settled Status',
  'EU_PRE_SETTLED': 'EU Pre-Settled Status',
  'non_eu_visa': 'Non-EU Visa Holder',
  'VISA': 'Visa',
  'SHARE_CODE': 'Share Code Verified',
  'indefinite_leave': 'Indefinite Leave to Remain',
  'time_limited': 'Time-Limited Leave to Remain',
  'renting_landlord': 'Renting from Private Landlord',
  'renting_agent': 'Renting via Letting Agent',
  'living_with_family': 'Living with Family/Friends',
  'employed': 'Employed',
  'self_employed': 'Self-Employed',
  'self-employed': 'Self-Employed',
  'benefits': 'Benefits',
  'savings': 'Savings/Investments',
  'pension': 'Pension',
  'rental_income': 'Landlord/Rental Income',
  'student': 'Student',
  'unemployed': 'Unemployed',
  'landlord_rental': 'Landlord Rental Income',
  'full_time': 'Full-Time',
  'part_time': 'Part-Time',
  'contract': 'Contract',
  'temporary': 'Temporary',
  'passport': 'Passport',
  'driving_licence': 'Driving Licence',
  'national_id': 'National ID Card',
  'single': 'Single',
  'married': 'Married',
  'divorced': 'Divorced',
  'widowed': 'Widowed',
  'civil_partnership': 'Civil Partnership',
  'cohabiting': 'Cohabiting'
}

const moneyKeys = new Set(['annualSalary', 'selfEmployedAnnualIncome', 'benefitsMonthlyAmount', 'savingsAmount',
  'pensionMonthlyAmount', 'monthlyRent', 'hourlyRate', 'calculatedAnnualIncome', 'annualIncome', 'rentShare',
  'rentalIncome', 'annualRentalIncome', 'totalDeclaredAnnualIncome'])
const dateKeys = new Set(['employmentStartDate', 'selfEmployedStartDate', 'dateOfBirth', 'tenancyStartDate',
  'tenancyEndDate', 'moveInDate', 'startDate', 'endDate'])

function formatDisplayValue(key: string, value: any): string {
  if (value === null || value === undefined || value === '') return '-'
  // Money fields
  if (moneyKeys.has(key)) {
    const num = parseFloat(String(value))
    if (!isNaN(num)) return `£${num.toLocaleString('en-GB')}`
  }
  // Date fields (YYYY-MM-DD → DD/MM/YYYY)
  if (dateKeys.has(key) && typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const d = new Date(value)
    if (!isNaN(d.getTime())) return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }
  return formatValue(value)
}

function formatValue(value: any): string {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (value === 'true') return 'Yes'
  if (value === 'false') return 'No'
  if (Array.isArray(value)) return value.map(v => valueMap[v] || String(v)).join(', ')
  const str = String(value)
  if (valueMap[str]) return valueMap[str]
  if (str.includes('_')) return str.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
  return str
}

function formatUKDateTime(dateStr: string): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/London'
  }) + ' GMT'
}

const creditResponseData = computed(() => {
  if (!section.value?.credit_check?.responseData) return null
  return section.value.credit_check.responseData
})

const previousAddressCreditCheck = computed(() => {
  const checks = section.value?.credit_checks || []
  return checks.find((c: any) => c.address_type === 'previous') || null
})

const creditRiskLabel = computed(() => {
  const score = section.value?.credit_check?.risk_score || 0
  if (score >= 80) return 'Low Risk'
  if (score >= 60) return 'Medium/Low Risk'
  if (score >= 40) return 'Medium Risk'
  return 'High Risk'
})

const adverseCreditDetails = computed(() => {
  // Pull from personal section of form_data (stored on reference)
  const personal = section.value?.reference?.form_data?.personal
  return personal?.adverseCreditDetails || null
})

const creditRiskColor = computed(() => {
  const score = section.value?.credit_check?.risk_score || 0
  if (score >= 80) return { bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-400' }
  if (score >= 60) return { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-400' }
  if (score >= 40) return { bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-700 dark:text-orange-400' }
  return { bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-400' }
})

const sectionTitle = computed(() => {
  const titles: Record<string, string> = {
    IDENTITY: 'Identity',
    RTR: 'Right to Rent',
    INCOME: 'Income',
    RESIDENTIAL: 'Residential',
    ADDRESS: 'Address', // Guarantor address verification
    CREDIT: 'Credit',
    AML: 'AML'
  }
  return titles[section.value?.section_type] || section.value?.section_type || 'Section'
})

const sectionIcon = computed(() => {
  const icons: Record<string, any> = {
    IDENTITY: IdCard,
    RTR: Home,
    INCOME: Briefcase,
    RESIDENTIAL: Building2,
    ADDRESS: Home, // Guarantor address verification
    CREDIT: CreditCard,
    AML: Shield
  }
  return icons[section.value?.section_type] || FileText
})

// Shared referee data formatter
function formatRefValue(key: string, value: any): string {
  if (value === null || value === undefined || value === '') return ''
  if (typeof value === 'boolean' || value === 'true' || value === 'false') {
    return value === true || value === 'true' ? 'Yes' : 'No'
  }
  const financialKeys = ['annualSalary', 'hourlyRate', 'calculatedAnnualIncome', 'annualIncome', 'declaredIncome', 'monthlyRent']
  if (financialKeys.includes(key)) {
    const num = parseFloat(String(value))
    if (!isNaN(num)) return `£${num.toLocaleString('en-GB')}`
  }
  if ((key.toLowerCase().includes('date') || key.toLowerCase().includes('start')) && typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const d = new Date(value)
    if (!isNaN(d.getTime())) return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }
  const valStr = String(value)
  if (valueMap[valStr]) return valueMap[valStr]
  return valStr
}

// Format referee form data: filter empty/internal fields, format values
function formatRefereeData(refData: Record<string, any>): Record<string, string> {
  const skipKeys = ['submittedAt', 'signature', 'refereeName', 'payType']
  return Object.fromEntries(
    Object.entries(refData)
      .filter(([k, v]) => !skipKeys.includes(k) && v !== null && v !== undefined && v !== '' && v !== '-')
      .map(([k, v]) => [k, formatRefValue(k, v)])
      .filter(([, v]) => v !== '')
  )
}

const checklistSteps = computed(() => {
  if (!section.value) return []

  // Build steps based on section type and evidence
  const type = section.value.section_type
  const evidence = section.value.evidence || {}

  switch (type) {
    case 'IDENTITY':
      return [
        {
          title: 'Review ID Document',
          checklistItems: [
            { label: 'Document is clear and readable', hint: 'Check all text is legible, no blur or glare' },
            { label: `Name matches: ${section.value.tenant_name || section.value.reference?.tenant_first_name + ' ' + (section.value.reference?.tenant_last_name || '') || 'tenant'}`.trim(), hint: 'Compare name on ID with application name exactly' },
            { label: 'Document is valid (check expiry date)', hint: 'Document must not be expired at move-in date' }
          ],
          evidence: evidence.id_document ? {
            type: 'image',
            url: evidence.id_document.url,
            label: 'ID Document'
          } : undefined,
          inputFields: [
            {
              name: 'document_type',
              label: 'Document Type',
              type: 'select',
              options: [
                { value: 'PASSPORT', label: 'Passport' },
                { value: 'DRIVING_LICENSE', label: 'Driving License' },
                { value: 'ID_CARD', label: 'ID Card' },
                { value: 'BRP', label: 'BRP Card' }
              ]
            },
            { name: 'expiry_date', label: 'Expiry Date', type: 'date' }
          ]
        },
        {
          title: 'Compare Selfie to ID',
          checklistItems: [
            { label: 'Same person in both photos', hint: 'Compare facial features, ears, nose shape' },
            { label: 'Selfie appears recent (matches ID age)', hint: 'Person should look same age as ID photo' },
            { label: 'No signs of photo manipulation', hint: 'Check for blurring, cut edges, inconsistent lighting' }
          ],
          evidence: evidence.selfie && evidence.id_document ? {
            type: 'compare',
            leftUrl: evidence.id_document.url,
            leftLabel: 'ID Photo',
            rightUrl: evidence.selfie.url,
            rightLabel: 'Selfie'
          } : undefined
        }
      ]

    case 'RTR':
      return [
        {
          title: 'Check Citizenship Status',
          checklistItems: [
            { label: 'Citizenship/visa status confirmed', hint: 'Verify the type of right to rent' },
            { label: 'Documentation is valid', hint: 'Check expiry dates and authenticity' }
          ],
          evidence: evidence.rtr_document ? {
            type: 'image',
            url: evidence.rtr_document.url,
            label: 'Right to Rent Evidence'
          } : undefined,
          inputFields: [
            {
              name: 'rtr_type',
              label: 'RTR Type',
              type: 'select',
              options: [
                { value: 'BRITISH_CITIZEN', label: 'British Citizen' },
                { value: 'EU_SETTLED', label: 'EU Settled Status' },
                { value: 'EU_PRE_SETTLED', label: 'EU Pre-Settled Status' },
                { value: 'VISA', label: 'Visa' },
                { value: 'SHARE_CODE', label: 'Share Code Verified' }
              ]
            },
            { name: 'rtr_expiry_date', label: 'RTR Expiry Date (if not British Citizen)', type: 'date' }
          ]
        },
        {
          title: 'Confirm Right to Rent',
          checklistItems: [
            { label: 'Right to rent status allows tenancy', hint: 'Status must permit renting in the UK' },
            { label: 'Valid until after move-in date', hint: 'Check expiry is after proposed move date' }
          ]
        }
      ]

    case 'INCOME': {

      const incomeSteps: any[] = []

      // Step 1: Employer/accountant reference review (added first)
      const incomeReferees = (section.value.referee_submissions || []).filter(
        (r: any) => r.referee_type === 'EMPLOYER' || r.referee_type === 'ACCOUNTANT'
      )
      let refereeConfirmedAnnual: number | null = null

      for (const referee of incomeReferees) {
        const isEmployer = referee.referee_type === 'EMPLOYER'
        const refData = referee.form_data || {}

        // Determine confirmed annual income from referee
        const refAnnual = parseFloat(refData.annualSalary) || parseFloat(refData.calculatedAnnualIncome) || null
        const confirmsEmployment = refData.confirmsEmployment === true || refData.confirmsEmployment === 'true'
        if (confirmsEmployment && refAnnual) {
          refereeConfirmedAnnual = refAnnual
        }

        // Format evidence data with value formatting, filtering out internal/empty fields
        const formattedData = formatRefereeData(refData)

        // Build confirmed income note if applicable
        const confirmedIncomeNote = confirmsEmployment && refAnnual
          ? `Confirmed Annual Income: £${refAnnual.toLocaleString('en-GB')}`
          : null

        incomeSteps.push({
          title: isEmployer ? 'Review Employer Reference' : 'Review Accountant Reference',
          checklistItems: isEmployer ? [
            { label: 'Employment confirmed', hint: 'Employer confirms active employment' },
            { label: 'Job title matches application', hint: 'Compare stated role' },
            { label: 'Salary matches income evidence', hint: 'Check for consistency' }
          ] : [
            { label: 'Client confirmed', hint: 'Accountant confirms client relationship' },
            { label: 'Income matches evidence', hint: 'Compare declared income' }
          ],
          evidence: {
            type: 'data',
            data: formattedData
          },
          inputFields: [],
          signatureUrl: refData.signature || null,
          refereeName: referee.referee_name || refData.refereeName || refData.accountantName,
          confirmedIncomeNote
        })
      }

      // Fallback to old employer_reference field if no referee_submissions
      if (incomeReferees.length === 0 && section.value.employer_reference) {
        incomeSteps.push({
          title: 'Review Employer Reference',
          checklistItems: [
            { label: 'Employment confirmed', hint: 'Employer confirms active employment' },
            { label: 'Job title matches application', hint: 'Compare stated role' },
            { label: 'Salary matches income evidence', hint: 'Check for consistency' }
          ],
          evidence: {
            type: 'data',
            data: section.value.employer_reference
          },
          inputFields: []
        })
      }

      // Step 2: Income evidence review (with auto-populated values from referee + tenant form)
      const annualPlaceholder = refereeConfirmedAnnual
        ? `£${refereeConfirmedAnnual.toLocaleString('en-GB')} (from referee)`
        : 'Auto-calculated'

      // Pull savings from tenant form data
      const tenantSavings = parseFloat(section.value.form_data?.savingsAmount) || 0
      const confirmedSavings = tenantSavings > 0 ? Math.round(tenantSavings * 0.9) : 0
      const savingsPlaceholder = confirmedSavings > 0
        ? `£${confirmedSavings.toLocaleString('en-GB')} (90% of £${tenantSavings.toLocaleString('en-GB')} declared)`
        : 'e.g. 10000'

      // Build checklist items with savings helper if applicable
      const incomeChecklist = [
        { label: 'Income evidence is present', hint: 'Payslips, bank statements, or tax returns' },
        { label: 'Evidence covers required period', hint: '3 months for employed, 12 months for self-employed' },
        { label: 'Income amounts are consistent', hint: 'Check for irregularities' }
      ]
      if (tenantSavings > 0) {
        incomeChecklist.push({
          label: `Tenant declared £${tenantSavings.toLocaleString('en-GB')} savings — 90% (£${confirmedSavings.toLocaleString('en-GB')}) can be accounted as income`,
          hint: 'Auto-populated below. Verify savings evidence matches declaration.'
        })
      }

      // Calculate required income for the affordability threshold
      // Required = multiplier × monthly rent (e.g. 30 × £1,275 = £38,250)
      const rentShare = section.value.rent_share || section.value.monthly_rent || 0
      const requiredMultiplier = section.value.is_guarantor ? 32 : 30

      incomeSteps.push({
        title: 'Review Income Evidence',
        checklistItems: incomeChecklist,
        evidence: evidence.payslips ? {
          type: 'document',
          url: evidence.payslips.url,
          label: 'Income Evidence',
          filename: evidence.payslips.filename
        } : undefined,
        affordabilityNote: rentShare > 0 ? {
          rentShare,
          requiredMultiplier,
          requiredAnnualIncome: rentShare * requiredMultiplier,
          isGuarantor: section.value.is_guarantor,
          confirmedAnnual: refereeConfirmedAnnual || null
        } : null,
        inputFields: [
          { name: 'monthly_income', label: 'Monthly Income Evidenced (£)', type: 'text', placeholder: 'e.g. 2900' },
          { name: 'annual_income', label: 'Annual Income (auto: monthly x 12, editable)', type: 'text', placeholder: annualPlaceholder },
          { name: 'savings', label: 'Confirmed Savings (£) — 90% of declared', type: 'text', placeholder: savingsPlaceholder },
          { name: 'total_effective_income', label: 'Total Effective Income (annual + savings, editable)', type: 'text', placeholder: 'Auto-calculated' }
        ],
        refereeConfirmedAnnual,
        tenantDeclaredSavings: confirmedSavings
      })

      return incomeSteps
    }

    case 'RESIDENTIAL': {
      const livingSituation = section.value.form_data?.currentLivingSituation || ''
      const isLivingWithFamily = livingSituation === 'living_with_family'

      if (isLivingWithFamily) {
        // Living with family — only need proof of address
        return [
          {
            title: 'Verify Proof of Address',
            checklistItems: [
              { label: `Living situation: ${formatValue(livingSituation)}`, hint: 'Tenant is living with family/friends — no landlord reference required' },
              { label: 'Proof of address document uploaded', hint: 'Check utility bill, bank statement, or council tax bill' },
              { label: 'Address on document matches application', hint: 'Compare document address with declared address' },
              { label: 'Document dated within 3 months', hint: 'Ensure proof of address is recent' }
            ],
            evidence: evidence.proof_of_address ? {
              type: 'document',
              url: evidence.proof_of_address.url,
              label: 'Proof of Address',
              filename: evidence.proof_of_address.filename
            } : undefined
          }
        ]
      }

      // Renting — need address history + landlord reference
      const residentialSteps: any[] = [
        {
          title: 'Check Address History',
          checklistItems: [
            { label: `Living situation: ${formatValue(livingSituation)}`, hint: 'Current housing arrangement' },
            { label: 'Current address provided', hint: 'Verify current living situation' },
            { label: 'Previous addresses if < 3 years at current', hint: 'Check address history completeness' }
          ],
          evidence: section.value.address_history ? {
            type: 'data',
            data: section.value.address_history
          } : undefined
        }
      ]

      // Add landlord referee submissions if available
      const landlordReferees = (section.value.referee_submissions || []).filter(
        (r: any) => r.referee_type === 'LANDLORD'
      )
      for (const referee of landlordReferees) {
        const refData = referee.form_data || {}
        const formattedData = formatRefereeData(refData)
        residentialSteps.push({
          title: `Review Landlord Reference${referee.referee_name ? ` - ${referee.referee_name}` : ''}`,
          checklistItems: [
            { label: 'Tenancy dates confirmed', hint: 'Verify move-in and move-out dates' },
            { label: 'Rent payment history reviewed', hint: 'Check for arrears or late payments' },
            { label: 'No issues reported', hint: 'Look for complaints or damages' }
          ],
          evidence: {
            type: 'data',
            data: formattedData
          },
          signatureUrl: refData.signature || null,
          refereeName: referee.referee_name || refData.refereeName
        })
      }

      // Fallback if no landlord referee submissions yet
      if (landlordReferees.length === 0) {
        residentialSteps.push({
          title: 'Review Landlord/Agent Reference',
          checklistItems: [
            { label: 'Tenancy dates confirmed', hint: 'Verify move-in and move-out dates' },
            { label: 'Rent payment history reviewed', hint: 'Check for arrears or late payments' },
            { label: 'No issues reported', hint: 'Look for complaints or damages' }
          ],
          evidence: section.value.landlord_reference ? {
            type: 'data',
            data: section.value.landlord_reference
          } : undefined
        })
      }

      return residentialSteps
    }

    case 'CREDIT': {
      const cc = section.value.credit_check
      const ccResponse = cc?.responseData || {}
      const ccFlags = ccResponse.flags || {}
      const ccSectionData = (section.value.section_data || {}) as Record<string, any>

      // Pull data from Creditsafe response or section_data
      const hasCcj = ccFlags.ccjMatch || ccSectionData.ccjMatch || false
      const hasInsolvency = ccFlags.insolvencyMatch || ccSectionData.insolvencyMatch || false
      const ccjCount = ccResponse.countyCourtJudgments?.length || ccSectionData.ccjCount || 0
      const insolvencyCount = ccResponse.insolvencies?.length || ccSectionData.insolvencyCount || 0
      const identityConfirmed = ccResponse.verifyMatch ?? ccSectionData.verifyMatch ?? false
      const electoralMatch = ccFlags.electoralRegisterMatch ?? ccSectionData.electoralRegisterMatch ?? false
      const deceasedMatch = ccFlags.deceasedRegisterMatch ?? ccSectionData.deceasedRegisterMatch ?? false

      // Tenant's adverse credit declaration
      const tenantDeclaredAdverse = section.value.reference?.has_adverse_credit || section.value.form_data?.hasAdverseCredit || section.value.reference?.form_data?.personal?.hasAdverseCredit || false
      const adverseDetails = section.value.reference?.adverse_credit_details || section.value.form_data?.adverseCreditDetails || section.value.reference?.form_data?.personal?.adverseCreditDetails || ''

      // Calculate PropertyGoose credit score
      const totalAdverse = ccjCount + insolvencyCount
      const hasAnyAdverse = hasCcj || hasInsolvency
      // PG Risk Score — start at 100, deduct based on findings
      // Pass mark: 70
      let pgCreditScore = 100
      const deductions: string[] = []

      // Electoral roll: -10 if not found
      if (!electoralMatch) {
        pgCreditScore -= 10
        deductions.push('Electoral roll not found (-10)')
      }

      // Identity not confirmed: -10
      if (!identityConfirmed) {
        pgCreditScore -= 10
        deductions.push('Identity not confirmed (-10)')
      }

      // Deceased register match: -50 (critical)
      if (deceasedMatch) {
        pgCreditScore -= 50
        deductions.push('Deceased register match (-50)')
      }

      // CCJs/Insolvency/Bankruptcy scoring
      if (hasAnyAdverse) {
        if (totalAdverse > 1) {
          // Multiple adverse items — heavy penalty
          pgCreditScore -= 50
          deductions.push(`Multiple adverse items: ${ccjCount} CCJ(s), ${insolvencyCount} insolvency/bankruptcy (-50)`)
        } else if (totalAdverse === 1 && !tenantDeclaredAdverse) {
          // Single item, NOT declared — worst case
          pgCreditScore -= 80
          deductions.push('Undeclared adverse credit (-80)')
        } else if (totalAdverse === 1 && tenantDeclaredAdverse) {
          // Single item, declared honestly — moderate deduction
          pgCreditScore -= 30
          deductions.push('Declared adverse credit, single item (-30)')
        }
      }

      pgCreditScore = Math.max(0, Math.min(100, pgCreditScore))
      const pgPasses = pgCreditScore >= 70
      const pgScoreLabel = pgPasses
        ? (pgCreditScore === 100 ? 'Clear' : `PASS${deductions.length ? ' — ' + deductions.join(', ') : ''}`)
        : `FAIL${deductions.length ? ' — ' + deductions.join(', ') : ''}`

      const scoreColor = pgCreditScore >= 70 ? '#1A7A4A' : pgCreditScore >= 50 ? '#B07D10' : '#C0392B'

      return [
        {
          title: 'Review Credit Check Results',
          checklistItems: [
            { label: 'Credit check completed', hint: 'Verify Creditsafe results received' },
            { label: `Identity: ${identityConfirmed ? 'Confirmed' : 'Not confirmed'}`, hint: 'Creditsafe identity verification' },
            { label: `Electoral Roll: ${electoralMatch ? 'Match found' : 'No match'}`, hint: 'Electoral register check' },
            { label: `CCJs: ${hasCcj ? ccjCount + ' found' : 'Clear'}`, hint: 'County Court Judgments' },
            { label: `Insolvency/Bankruptcy: ${hasInsolvency ? insolvencyCount + ' found' : 'Clear'}`, hint: 'IVAs, bankruptcy, debt relief orders' },
            { label: `Deceased Register: ${deceasedMatch ? 'MATCH' : 'Clear'}`, hint: 'Deceased register check' }
          ],
          evidence: {
            type: 'data',
            data: {
              'PG Risk Score': `${pgCreditScore}/100 — ${pgScoreLabel}`,
              'CCJs': hasCcj ? `${ccjCount} found` : 'None',
              'Insolvency / Bankruptcy': hasInsolvency ? `${insolvencyCount} found` : 'None',
              'Electoral Roll': electoralMatch ? 'Match' : 'No match',
              'Identity Confirmed': identityConfirmed ? 'Yes' : 'No',
              ...(tenantDeclaredAdverse ? {
                '⚠ Tenant Declared Adverse Credit': 'YES',
                'Declaration Details': adverseDetails || 'No details provided'
              } : {
                'Tenant Declared Adverse Credit': 'No'
              }),
              ...(cc?.transaction_id ? { 'Transaction ID': cc.transaction_id } : {}),
              ...(cc?.created_at || ccSectionData.checkedAt ? { 'Checked': new Date(cc?.created_at || ccSectionData.checkedAt).toLocaleDateString('en-GB') } : {})
            }
          },
          confirmedIncomeNote: pgCreditScore >= 70
            ? `PG Risk Score: ${pgCreditScore}/100 — ${pgScoreLabel}`
            : null
        }
      ]
    }

    case 'AML':
      return [
        {
          title: 'Review AML Check Results',
          checklistItems: [
            { label: 'Sanctions screening completed', hint: 'Verify no matches on sanctions lists' },
            { label: 'PEP status checked', hint: 'Check Politically Exposed Person status' },
            { label: 'No adverse findings', hint: 'Review for any concerns' }
          ],
          evidence: section.value.aml_check ? {
            type: 'data',
            data: {
              'Sanctions': section.value.aml_check.sanctions_match ? 'MATCH' : 'Clear',
              'PEP Status': section.value.aml_check.pep_status || 'Not PEP',
              'Adverse Media': section.value.aml_check.adverse_media ? 'Found' : 'None'
            }
          } : undefined
        }
      ]

    case 'ADDRESS':
      // Guarantor address verification - simpler than RESIDENTIAL
      return [
        {
          title: 'Verify Current Address',
          checklistItems: [
            { label: 'Address provided', hint: 'Verify guarantor has provided their address' },
            { label: 'Proof of address uploaded', hint: 'Check for utility bill, bank statement, or council tax' },
            { label: 'Document dated within 3 months', hint: 'Ensure proof of address is recent' },
            { label: 'Address matches document', hint: 'Verify address on document matches provided address' }
          ],
          evidence: evidence.proofOfAddress ? {
            type: 'document',
            url: evidence.proofOfAddress
          } : undefined
        }
      ]

    default:
      return []
  }
})

async function rerunCreditCheck() {
  creditRerunLoading.value = true
  try {
    const response = await fetch(`${API_URL}/api/v2/sections/${sectionId.value}/rerun-credit-check`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    })

    if (response.ok) {
      // Refresh the section to show new results
      await fetchSection()
      showCreditRerun.value = false
      showRawCreditData.value = false
    } else {
      const err = await response.json()
      alert(`Credit check failed: ${err.error || 'Unknown error'}`)
    }
  } catch (error) {
    console.error('Error re-running credit check:', error)
    alert('Failed to re-run credit check')
  } finally {
    creditRerunLoading.value = false
  }
}

async function fetchSection() {
  loading.value = true
  try {
    const response = await fetch(`${API_URL}/api/v2/sections/${sectionId.value}`, {
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`
      }
    })

    if (response.ok) {
      section.value = await response.json()
    } else {
      router.push({ name: 'StaffDashboardV2' })
    }
  } catch (error) {
    console.error('Error fetching section:', error)
    router.push({ name: 'StaffDashboardV2' })
  } finally {
    loading.value = false
  }
}

function viewImage(url: string) {
  viewingImage.value = url
}

function onStepComplete(index: number, data: any) {
  // Merge input values from each step into collected values
  if (data?.inputValues) {
    Object.assign(collectedInputValues.value, data.inputValues)
  }

  const steps = checklistSteps.value
  const completedStep = steps[index]

  // If referee step completed with confirmed annual income, pre-populate for income calculator
  if (completedStep?.refereeConfirmedAnnual && !collectedInputValues.value.annual_income) {
    collectedInputValues.value.annual_income = String(Math.round(completedStep.refereeConfirmedAnnual))
  }

  // Auto-populate savings from tenant declaration (90% already applied)
  if (completedStep?.tenantDeclaredSavings && !collectedInputValues.value.savings) {
    collectedInputValues.value.savings = String(completedStep.tenantDeclaredSavings)
  }

  // Pre-populate annual from referee if available and not already set
  const refereeAnnual = completedStep?.refereeConfirmedAnnual
  if (refereeAnnual && !collectedInputValues.value.annual_income) {
    collectedInputValues.value.annual_income = String(Math.round(refereeAnnual))
    collectedInputValues.value.monthly_income = String(Math.round(refereeAnnual / 12))
  }

  // Auto-calculate income fields
  const monthly = parseFloat(collectedInputValues.value.monthly_income)
  const savings = parseFloat(collectedInputValues.value.savings)

  if (!isNaN(monthly) && !collectedInputValues.value.annual_income) {
    collectedInputValues.value.annual_income = String(Math.round(monthly * 12))
  }

  // Total effective = annual income + confirmed savings
  const annual = parseFloat(collectedInputValues.value.annual_income) || 0
  const confirmedSavings = !isNaN(savings) ? savings : 0
  if (annual > 0 || confirmedSavings > 0) {
    collectedInputValues.value.total_effective_income = String(Math.round(annual + confirmedSavings))
  }
}

async function onIssueReported(index: number, reason: string, notes: string, requestType: string = 'document') {
  try {
    const response = await fetch(`${API_URL}/api/v2/sections/${sectionId.value}/report-issue`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        issueType: reason,
        notes,
        requestType
      })
    })

    if (response.ok) {
      alert('Issue reported — tenant and agent notified')
      router.push({ name: 'StaffDashboardV2' })
    } else {
      const data = await response.json()
      alert(`Error: ${data.error || 'Failed to report issue'}`)
    }
  } catch (error) {
    console.error('Error reporting issue:', error)
    alert('Failed to report issue')
  }
}

function onAllStepsComplete(data: any) {
  console.log('All steps complete:', data)
}

async function submitDecision(data: any) {
  submitting.value = true
  try {
    const payload = {
      ...data,
      checklist_results: Object.keys(collectedInputValues.value).length > 0 ? collectedInputValues.value : undefined
    }
    const response = await fetch(`${API_URL}/api/v2/sections/${sectionId.value}/decision`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    if (response.ok) {
      router.push({ name: 'StaffDashboardV2' })
    } else {
      const error = await response.json()
      alert(error.error || 'Failed to submit decision')
    }
  } catch (error) {
    console.error('Error submitting decision:', error)
    alert('Failed to submit decision')
  } finally {
    submitting.value = false
  }
}

async function releaseToQueue() {
  try {
    const response = await fetch(`${API_URL}/api/v2/sections/${sectionId.value}/release`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`
      }
    })

    if (response.ok) {
      router.push({ name: 'StaffDashboardV2' })
    } else {
      const error = await response.json()
      alert(error.error || 'Failed to release item')
    }
  } catch (error) {
    console.error('Error releasing item:', error)
    alert('Failed to release item')
  }
}

function goBack() {
  router.back()
}

onMounted(() => {
  fetchSection()
})
</script>
