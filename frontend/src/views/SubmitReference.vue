<template>
  <div class="min-h-screen bg-gray-50 dark:bg-slate-900 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-3xl mx-auto">
      <!-- Header -->
      <div v-if="!initialLoading" class="text-center mb-8">
        <div class="flex justify-center items-center gap-3 mb-4">
          <template v-if="companyLogo">
            <img :src="companyLogo" alt="Company Logo" class="h-20 object-contain" />
          </template>
          <template v-else>
            <img src="/PropertyGooseLogo.png" alt="PropertyGoose" class="h-12 dark:hidden" />
            <img src="/PropertyGooseLogoDark.png" alt="PropertyGoose" class="h-12 hidden dark:block" />
          </template>
        </div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Tenant Reference Form</h1>
        <p class="mt-2 text-gray-600 dark:text-slate-400">Please complete all sections to submit your reference</p>
      </div>

      <!-- Progress Bar -->
      <div v-if="showProgressBar" class="mb-8">
        <div class="flex justify-between items-center mb-2">
          <span class="text-sm font-medium text-gray-700 dark:text-slate-300">Page {{ currentPage }} of 11</span>
          <span class="text-sm text-gray-500 dark:text-slate-400">{{ Math.round((currentPage / 11) * 100) }}% Complete</span>
        </div>
        <div class="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
          <div class="h-2 rounded-full transition-all duration-300"
            :style="{ width: (currentPage / 11 * 100) + '%', backgroundColor: primaryColor }"></div>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="initialLoading" class="bg-white dark:bg-slate-800 rounded-lg shadow p-8 text-center">
        <div class="text-gray-600 dark:text-slate-400">Loading reference details...</div>
      </div>

      <!-- Error State -->
      <div v-else-if="tokenError" class="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-6 py-4 rounded-lg">
        {{ tokenError }}
      </div>

      <!-- Success/Already Submitted -->
      <div v-else-if="reference && reference.submitted_at" class="bg-white dark:bg-slate-800 rounded-lg shadow p-8 text-center">
        <CheckCircle class="mx-auto h-12 w-12 text-green-500" />
        <h3 class="mt-4 text-lg font-semibold text-gray-900 dark:text-white">{{ justSubmitted ? 'Thank You!' : 'Reference Already Submitted' }}</h3>
        <p class="mt-2 text-gray-600 dark:text-slate-400">{{ justSubmitted ? 'Your reference has been submitted successfully. We appreciate you taking the time to complete this form.' : 'You have already submitted this reference. Thank you!' }}</p>
      </div>

      <!-- Form -->
      <div v-else-if="reference">
        <DeviceHandoffGate v-if="showDeviceGate" :title="deviceGateTitle" :description="deviceGateDescription"
          :company-name="agentCompanyName" :company-logo="companyLogo" :company-contact-email="agentCompanyEmail"
          :company-contact-phone="agentCompanyPhone" :company-contact-address="agentCompanyAddress"
          :company-website="agentCompanyWebsite" :request-details="tenantRequestDetails" :link="deviceLink"
          :primary-color="primaryColor" :button-color="buttonColor"
          proceed-label="Proceed on this device (Camera required)" @proceed="handleDeviceGateProceed" />
        <form v-else @submit.prevent="handlePageSubmit" class="space-y-6">

          <!-- PAGE 1: ID Document Upload -->
          <div v-if="currentPage === 1" class="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
            <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">Identification Document</h2>

            <!-- Reference Details Notice -->
            <div class="mb-6 p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p class="text-sm text-gray-700 dark:text-slate-300">
                The agent <strong>{{ reference.company_name || 'from the lettings agency' }}</strong> has requested
                this reference for you to begin your new tenancy at <strong>{{ reference.property_address }}</strong>.
                They have proposed <strong>{{ formatDate(reference.move_in_date) }}</strong> as your move-in date.
              </p>
            </div>

            <p class="text-sm text-gray-600 dark:text-slate-400 mb-6">Please upload a clear photo of your Driving Licence or Passport</p>

            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Document Type *</label>
                <select v-model="formData.id_document_type" required
                  class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:text-white">
                  <option value="">Select document type</option>
                  <option value="driving_licence">Driving Licence</option>
                  <option value="passport">Passport</option>
                </select>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Upload Document *</label>
                <input ref="idDocumentInput" type="file" @change="handleIdDocumentUpload" accept=".pdf,.jpg,.jpeg,.png"
                  class="hidden" />
                <button type="button" @click="($refs.idDocumentInput as any).click()"
                  class="px-4 py-2 text-sm font-semibold bg-blue-50 rounded-md hover:bg-blue-100"
                  :style="{ color: buttonColor }">
                  {{ idDocument ? 'Change File' : 'Choose File' }}
                </button>
                <p class="mt-1 text-xs text-gray-500 dark:text-slate-400">Upload PDF or image (max 10MB)</p>
                <div v-if="idDocument" class="mt-2 p-3 bg-gray-50 dark:bg-slate-700 rounded">
                  <div class="flex items-center justify-between">
                    <span class="text-sm text-gray-700 dark:text-slate-300">{{ idDocument.name }} ({{ formatFileSize(idDocument.size)
                      }})</span>
                    <button type="button" @click="removeIdDocument" class="text-red-600 hover:text-red-800">
                      <X class="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div v-else-if="formData.id_document_path" class="mt-2 p-3 bg-green-50 dark:bg-green-900/30 rounded border border-green-200 dark:border-green-800">
                  <div class="flex items-center">
                    <Check class="w-4 h-4 text-green-600 mr-2" />
                    <span class="text-sm text-green-700 dark:text-green-400">ID document uploaded successfully</span>
                  </div>
                </div>
              </div>

            </div>
          </div>

          <!-- PAGE 2: Personal Details -->
          <div v-if="currentPage === 2" class="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
            <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">Personal Details</h2>
            <p class="text-sm text-gray-600 dark:text-slate-400 mb-6">Please ensure these details match your ID document</p>

            <div class="space-y-4">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">First Name *</label>
                  <input
                    v-model="formData.first_name"
                    type="text"
                    required
                    :class="[
                      'mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-md focus:ring-primary focus:border-primary dark:text-white',
                      fieldErrors.first_name ? 'border-red-300' : 'border-gray-300 dark:border-slate-600'
                    ]"
                  />
                  <p v-if="fieldErrors.first_name" class="mt-1 text-sm text-red-600">
                    {{ fieldErrors.first_name }}
                  </p>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Middle Name</label>
                  <input v-model="formData.middle_name" type="text"
                    class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:text-white" />
                </div>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Last Name *</label>
                <input
                  v-model="formData.last_name"
                  type="text"
                  required
                  :class="[
                    'mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-md focus:ring-primary focus:border-primary dark:text-white',
                    fieldErrors.last_name ? 'border-red-300' : 'border-gray-300 dark:border-slate-600'
                  ]"
                />
                <p v-if="fieldErrors.last_name" class="mt-1 text-sm text-red-600">
                  {{ fieldErrors.last_name }}
                </p>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Date of Birth *</label>
                <div class="grid grid-cols-3 gap-3">
                  <div>
                    <select
                      v-model="dobDay"
                      required
                      :class="[
                        'block w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-md focus:ring-primary focus:border-primary dark:text-white',
                        fieldErrors.dob ? 'border-red-300' : 'border-gray-300 dark:border-slate-600'
                      ]"
                    >
                      <option value="">Day</option>
                      <option v-for="day in 31" :key="day" :value="day">{{ day }}</option>
                    </select>
                  </div>
                  <div>
                    <select
                      v-model="dobMonth"
                      required
                      :class="[
                        'block w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-md focus:ring-primary focus:border-primary dark:text-white',
                        fieldErrors.dob ? 'border-red-300' : 'border-gray-300 dark:border-slate-600'
                      ]"
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
                      :class="[
                        'block w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-md focus:ring-primary focus:border-primary dark:text-white',
                        fieldErrors.dob ? 'border-red-300' : 'border-gray-300 dark:border-slate-600'
                      ]"
                    >
                      <option value="">Year</option>
                      <option v-for="year in yearRange" :key="year" :value="year">{{ year }}</option>
                    </select>
                  </div>
                </div>
                <p v-if="fieldErrors.dob" class="mt-1 text-sm text-red-600">
                  {{ fieldErrors.dob }}
                </p>
              </div>

              <PhoneInput
                v-model="formData.contact_number"
                label="Contact Number"
                id="contact-number"
                :required="true"
              />
              <p v-if="fieldErrors.contact_number" class="mt-1 text-sm text-red-600">
                {{ fieldErrors.contact_number }}
              </p>

              <div class="relative">
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Nationality *</label>
                <input
                  v-model="nationalitySearch"
                  @focus="showNationalityDropdown = true"
                  @input="showNationalityDropdown = true"
                  @blur="hideNationalityDropdown"
                  type="text"
                  required
                  placeholder="Search and select nationality..."
                  autocomplete="off"
                  :class="[
                    'mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-md focus:ring-primary focus:border-primary dark:text-white',
                    fieldErrors.nationality ? 'border-red-300' : 'border-gray-300 dark:border-slate-600'
                  ]"
                />
                <div v-if="showNationalityDropdown && filteredNationalities.length > 0"
                  class="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-md shadow-lg max-h-60 overflow-auto">
                  <div v-for="nationality in filteredNationalities" :key="nationality"
                    @mousedown.prevent="selectNationality(nationality)"
                    class="px-3 py-2 hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer text-sm dark:text-slate-300">
                    {{ nationality }}
                  </div>
                </div>
              </div>
              <p v-if="fieldErrors.nationality" class="mt-1 text-sm text-red-600">
                {{ fieldErrors.nationality }}
              </p>

              <!-- Right to Rent Verification -->
              <div v-if="formData.nationality" class="mt-6 pt-6 border-t border-gray-200 dark:border-slate-700">
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Right to Rent Verification</h3>

                <!-- BRITISH CITIZENS - Passport or alternative documents -->
                <div v-if="formData.nationality.toLowerCase() === 'british'" class="space-y-4">
                  <div class="p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg mb-4">
                    <p class="text-sm text-blue-800 dark:text-blue-300">
                      <strong>British Citizen Verification:</strong> Please upload your passport to verify your right to rent.
                      If you don't have a passport, you can upload a driving licence or birth certificate instead.
                    </p>
                  </div>

                  <!-- Passport Upload (Primary option) -->
                  <div v-if="!formData.rtr_british_no_passport">
                    <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Upload Passport *</label>
                    <input ref="rtrBritishPassportInput" type="file" @change="handleBritishPassportUpload"
                      accept=".pdf,.jpg,.jpeg,.png" class="hidden" />
                    <button type="button" @click="($refs.rtrBritishPassportInput as any).click()"
                      class="px-4 py-2 text-sm font-semibold bg-blue-50 rounded-md hover:bg-blue-100"
                      :style="{ color: buttonColor }">
                      {{ rtrBritishPassport ? 'Change File' : 'Choose File' }}
                    </button>
                    <p class="mt-1 text-xs text-gray-500 dark:text-slate-400">Upload PDF or image (max 10MB)</p>

                    <div v-if="rtrBritishPassport"
                      class="mt-2 p-3 bg-gray-50 dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600 flex items-center justify-between">
                      <span class="text-sm text-gray-700 dark:text-slate-300">
                        {{ rtrBritishPassport.name }} ({{ formatFileSize(rtrBritishPassport.size) }})
                      </span>
                      <button type="button" @click="removeBritishPassport"
                        class="text-red-600 hover:text-red-800 text-sm">
                        Remove
                      </button>
                    </div>
                    <div v-else-if="formData.rtr_british_passport_path"
                      class="mt-2 p-3 bg-green-50 dark:bg-green-900/30 rounded border border-green-200 dark:border-green-800">
                      <div class="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
                        <Check class="w-4 h-4" />
                        Passport uploaded successfully
                      </div>
                    </div>
                  </div>

                  <!-- No Passport Checkbox -->
                  <div class="flex items-center gap-2 mt-4">
                    <input type="checkbox" id="no-passport" v-model="formData.rtr_british_no_passport"
                      @change="handleNoPassportChange"
                      class="h-4 w-4 text-primary border-gray-300 dark:border-slate-600 rounded focus:ring-primary" />
                    <label for="no-passport" class="text-sm text-gray-700 dark:text-slate-300">I do not have a passport</label>
                  </div>

                  <!-- Alternative Document (if no passport) -->
                  <div v-if="formData.rtr_british_no_passport" class="mt-4 p-4 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg space-y-4">
                    <p class="text-sm text-gray-700 dark:text-slate-300">
                      Please upload <strong>either</strong> a Driving Licence or Birth Certificate to verify your identity.
                    </p>

                    <div>
                      <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Document Type *</label>
                      <select v-model="formData.rtr_british_alt_doc_type"
                        class="block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:text-white">
                        <option value="">Select document type</option>
                        <option value="driving_license">Driving Licence</option>
                        <option value="birth_certificate">Birth Certificate</option>
                      </select>
                    </div>

                    <div v-if="formData.rtr_british_alt_doc_type">
                      <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                        Upload {{ formData.rtr_british_alt_doc_type === 'driving_license' ? 'Driving Licence' : 'Birth Certificate' }} *
                      </label>
                      <input ref="rtrBritishAltDocInput" type="file" @change="handleBritishAltDocUpload"
                        accept=".pdf,.jpg,.jpeg,.png" class="hidden" />
                      <button type="button" @click="($refs.rtrBritishAltDocInput as any).click()"
                        class="px-4 py-2 text-sm font-semibold bg-blue-50 rounded-md hover:bg-blue-100"
                        :style="{ color: buttonColor }">
                        {{ rtrBritishAltDoc ? 'Change File' : 'Choose File' }}
                      </button>
                      <p class="mt-1 text-xs text-gray-500 dark:text-slate-400">Upload PDF or image (max 10MB)</p>

                      <div v-if="rtrBritishAltDoc"
                        class="mt-2 p-3 bg-gray-50 dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600 flex items-center justify-between">
                        <span class="text-sm text-gray-700 dark:text-slate-300">
                          {{ rtrBritishAltDoc.name }} ({{ formatFileSize(rtrBritishAltDoc.size) }})
                        </span>
                        <button type="button" @click="removeBritishAltDoc"
                          class="text-red-600 hover:text-red-800 text-sm">
                          Remove
                        </button>
                      </div>
                      <div v-else-if="formData.rtr_british_alt_doc_path"
                        class="mt-2 p-3 bg-green-50 dark:bg-green-900/30 rounded border border-green-200 dark:border-green-800">
                        <div class="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
                          <Check class="w-4 h-4" />
                          Document uploaded successfully
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- INTERNATIONAL TENANTS - Share code + optional evidence -->
                <div v-else class="space-y-4">
                  <div class="p-4 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg mb-4">
                    <p class="text-sm text-yellow-800 dark:text-yellow-300">
                      <strong>Right to Rent Check Required:</strong> Please provide your Home Office Right to Rent share code.
                      You can get this from:
                      <a href="https://www.gov.uk/prove-right-to-rent" target="_blank"
                        class="underline">www.gov.uk/prove-right-to-rent</a>
                    </p>
                  </div>

                  <!-- Share Code Entry (Required - no API verification) -->
                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Right to Rent Share Code *</label>
                    <input v-model="formData.rtr_share_code" type="text"
                      placeholder="e.g., RABC1234DEF"
                      maxlength="20"
                      class="block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:text-white uppercase"
                      @input="formData.rtr_share_code = formData.rtr_share_code.toUpperCase()" />
                    <p class="mt-1 text-xs text-gray-500 dark:text-slate-400">Enter your share code from the Home Office (typically starts with 'R')</p>
                  </div>

                  <!-- Evidence Upload (Optional) -->
                  <div class="mt-4 p-4 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg space-y-4">
                    <p class="text-sm text-gray-700 dark:text-slate-300">
                      <strong>Optional:</strong> You can also upload supporting evidence such as a screenshot of your share code verification, visa, or BRP.
                    </p>

                    <div>
                      <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Document Type</label>
                      <select v-model="formData.rtr_alternative_document_type"
                        class="block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:text-white">
                        <option value="">Select document type (optional)</option>
                        <option value="screenshot">Screenshot of Share Code Verification</option>
                        <option value="visa">Visa</option>
                        <option value="brp">Biometric Residence Permit (BRP)</option>
                      </select>
                    </div>

                    <div v-if="formData.rtr_alternative_document_type">
                      <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Upload Document</label>
                      <input ref="rtrAlternativeDocumentInput" type="file" @change="handleAlternativeDocumentUpload"
                        accept=".pdf,.jpg,.jpeg,.png" class="hidden" />
                      <button type="button" @click="($refs.rtrAlternativeDocumentInput as any).click()"
                        class="px-4 py-2 text-sm font-semibold bg-blue-50 rounded-md hover:bg-blue-100"
                        :style="{ color: buttonColor }">
                        {{ rtrAlternativeDocument ? 'Change File' : 'Choose File' }}
                      </button>
                      <p class="mt-1 text-xs text-gray-500 dark:text-slate-400">Upload PDF or image (max 10MB)</p>

                      <div v-if="rtrAlternativeDocument"
                        class="mt-2 p-3 bg-gray-50 dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600 flex items-center justify-between">
                        <span class="text-sm text-gray-700 dark:text-slate-300">
                          {{ rtrAlternativeDocument.name }} ({{ formatFileSize(rtrAlternativeDocument.size) }})
                        </span>
                        <button type="button" @click="removeAlternativeDocument"
                          class="text-red-600 hover:text-red-800 text-sm">
                          Remove
                        </button>
                      </div>
                      <div v-else-if="formData.rtr_alternative_document_path"
                        class="mt-2 p-3 bg-green-50 dark:bg-green-900/30 rounded border border-green-200 dark:border-green-800">
                        <div class="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
                          <Check class="w-4 h-4" />
                          Document uploaded successfully
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- PAGE 3: Selfie -->
          <div v-if="currentPage === 3" class="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
            <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">Selfie Verification</h2>
            <p class="text-sm text-gray-600 dark:text-slate-400 mb-6">Please take a clear selfie for identity verification using your camera
            </p>

            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Take Selfie *</label>

                <!-- Camera stream view -->
                <div v-if="showCameraStream" class="space-y-4">
                  <div class="relative bg-black rounded-lg overflow-hidden" style="max-width: 640px;">
                    <video ref="videoElement" autoplay playsinline class="w-full h-auto"
                      style="transform: scaleX(-1);"></video>
                    <canvas ref="canvasElement" class="hidden"></canvas>
                  </div>
                  <div class="flex gap-2">
                    <button type="button" @click="capturePhoto"
                      class="px-4 py-2 text-sm font-semibold bg-blue-50 rounded-md hover:bg-blue-100"
                      :style="{ color: buttonColor }">
                      📸 Capture Photo
                    </button>
                    <button type="button" @click="stopCamera"
                      class="px-4 py-2 text-sm font-semibold bg-gray-100 dark:bg-slate-700 rounded-md hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-300">
                      Cancel
                    </button>
                  </div>
                </div>

                <!-- Camera start button or preview -->
                <div v-else>
                  <div v-if="selfie" class="space-y-4">
                    <img v-if="selfiePreview" :src="selfiePreview" alt="Selfie preview"
                      class="w-48 h-48 object-cover rounded-lg border-2 border-gray-300 dark:border-slate-600" />
                    <div class="flex items-center gap-2">
                      <span class="text-sm text-gray-700 dark:text-slate-300">Photo captured ({{ formatFileSize(selfie.size) }})</span>
                      <button type="button" @click="removeSelfie" class="text-red-600 hover:text-red-800 text-sm">
                        Remove
                      </button>
                    </div>
                  </div>

                  <div v-else-if="formData.selfie_path" class="space-y-4">
                    <div class="p-3 bg-green-50 dark:bg-green-900/30 rounded border border-green-200 dark:border-green-800">
                      <div class="flex items-center justify-between">
                        <div class="flex items-center">
                          <Check class="w-4 h-4 text-green-600 mr-2" />
                          <span class="text-sm text-green-700 dark:text-green-400">Selfie uploaded successfully</span>
                        </div>
                        <button type="button" @click="removeSelfie"
                          class="text-red-600 hover:text-red-800 text-sm ml-4">
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>

                  <div v-else>
                    <button type="button" @click="startCamera"
                      class="px-4 py-2 text-sm font-semibold bg-blue-50 rounded-md hover:bg-blue-100"
                      :style="{ color: buttonColor }">
                      📷 Take Photo
                    </button>
                  </div>
                </div>

                <p v-if="cameraError" class="mt-2 text-sm text-red-600">{{ cameraError }}</p>
                <p v-else class="mt-1 text-xs text-gray-500 dark:text-slate-400">Please open this reference on your mobile phone. A photo
                  must be taken using your device's camera for AML compliance.</p>
              </div>
            </div>
          </div>

          <!-- PAGE 4: Address Details -->
          <div v-if="currentPage === 4" class="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
            <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">Current Address Details</h2>
            <p class="text-sm text-gray-600 dark:text-slate-400 mb-6">Please provide your current residential address</p>

            <div class="space-y-4">
              <div>
                <AddressAutocomplete v-model="formData.current_address_line1" label="Address Line 1" :required="true"
                  placeholder="Start typing address..." @addressSelected="handleCurrentAddressSelected"
                  :allowManualEntry="true" />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Address Line 2</label>
                <input v-model="formData.current_address_line2" type="text"
                  placeholder="Apartment, suite, building, floor, etc."
                  class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:text-white" />
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">City *</label>
                  <input v-model="formData.current_city" type="text" required :placeholder="cityPlaceholder"
                    class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:text-white" />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">{{ postcodeLabel }} *</label>
                  <input v-model="formData.current_postcode" type="text" required :placeholder="postcodePlaceholder"
                    class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:text-white" />
                </div>
              </div>

              <div class="relative">
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Country *</label>
                <input v-model="countrySearch" @focus="showCountryDropdown = true" @input="showCountryDropdown = true"
                  @blur="hideCountryDropdown" type="text" required placeholder="Search and select country..."
                  autocomplete="off"
                  class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:text-white" />
                <div v-if="showCountryDropdown && filteredCountries.length > 0"
                  class="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-md shadow-lg max-h-60 overflow-auto">
                  <div v-for="country in filteredCountries" :key="country?.code || ''"
                    @mousedown.prevent="country && selectCountry(country)"
                    class="px-3 py-2 hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer text-sm dark:text-slate-300">
                    {{ country?.name }}
                  </div>
                </div>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Time at Current Address *</label>
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="block text-xs text-gray-600 dark:text-slate-400 mb-1">Years</label>
                    <input v-model.number="formData.time_at_address_years" type="number" min="0" max="100" required
                      placeholder="0"
                      class="block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:text-white" />
                  </div>
                  <div>
                    <label class="block text-xs text-gray-600 dark:text-slate-400 mb-1">Months</label>
                    <input v-model.number="formData.time_at_address_months" type="number" min="0" max="11" required
                      placeholder="0"
                      class="block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:text-white" />
                  </div>
                </div>
                <p class="mt-1 text-xs text-gray-500 dark:text-slate-400">How long have you been living at this address?</p>
              </div>

              <!-- Previous Addresses (if needed for 3-year history) -->
              <div v-if="needsMoreAddressHistory || previousAddresses.length > 0" class="mt-8 pt-6 border-t border-gray-200 dark:border-slate-700">
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Previous Address History</h3>
                <p class="text-sm text-gray-600 dark:text-slate-400 mb-4">We need 3 years of address history. Please provide your previous
                  addresses.</p>
                <p class="text-xs text-gray-500 dark:text-slate-400 mb-6">
                  Current history: {{ totalAddressHistoryYears }} year{{ totalAddressHistoryYears !== 1 ? 's' : '' }},
                  {{ totalAddressHistoryMonths }} month{{ totalAddressHistoryMonths !== 1 ? 's' : '' }}
                  ({{ Math.floor(totalAddressHistoryInMonths / 12) }} years {{ totalAddressHistoryInMonths % 12 }}
                  months total)
                  <span v-if="totalAddressHistoryInMonths >= 36" class="text-green-600 font-medium">✓ Requirement
                    met</span>
                </p>

                <div v-for="(address, index) in previousAddresses" :key="index" class="mb-6 p-4 bg-gray-50 dark:bg-slate-700 rounded-lg">
                  <div class="flex justify-between items-center mb-4">
                    <h4 class="text-md font-semibold text-gray-900 dark:text-white">Previous Address {{ index + 1 }}</h4>
                    <button type="button" @click="removePreviousAddress(index)"
                      class="text-red-600 hover:text-red-800 text-sm">
                      Remove
                    </button>
                  </div>

                  <div class="space-y-4">
                    <div>
                      <AddressAutocomplete v-model="address.address_line1" label="Address Line 1" :required="true"
                        placeholder="Start typing address..."
                        @addressSelected="(data) => handlePreviousAddressSelected(index, data)"
                        :allowManualEntry="true" />
                    </div>

                    <div>
                      <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Address Line 2</label>
                      <input v-model="address.address_line2" type="text"
                        placeholder="Apartment, suite, building, floor, etc."
                        class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:text-white" />
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">City *</label>
                        <input v-model="address.city" type="text" required
                          :placeholder="getPreviousAddressCityPlaceholder(index)"
                          class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:text-white" />
                      </div>
                      <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">{{ getPreviousAddressPostcodeLabel(index)
                          }} *</label>
                        <input v-model="address.postcode" type="text" required
                          :placeholder="getPreviousAddressPostcodePlaceholder(index)"
                          class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:text-white" />
                      </div>
                    </div>

                    <div class="relative">
                      <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Country *</label>
                      <input v-model="previousAddressCountrySearches[index]"
                        @focus="showPreviousAddressCountryDropdowns[index] = true"
                        @input="showPreviousAddressCountryDropdowns[index] = true"
                        @blur="hidePreviousAddressCountryDropdown(index)" type="text" required
                        placeholder="Search and select country..." autocomplete="off"
                        class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:text-white" />
                      <div
                        v-if="showPreviousAddressCountryDropdowns[index] && filteredPreviousAddressCountries(index).length > 0"
                        class="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-md shadow-lg max-h-60 overflow-auto">
                        <div v-for="country in filteredPreviousAddressCountries(index)" :key="country?.code || ''"
                          @mousedown.prevent="country && selectPreviousAddressCountry(index, country)"
                          class="px-3 py-2 hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer text-sm dark:text-slate-300">
                          {{ country?.name }}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Time at This Address *</label>
                      <div class="grid grid-cols-2 gap-4">
                        <div>
                          <label class="block text-xs text-gray-600 dark:text-slate-400 mb-1">Years</label>
                          <input v-model.number="address.time_at_address_years" type="number" min="0" max="100" required
                            placeholder="0"
                            class="block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:text-white"
                            @input="updateAddressHistory" />
                        </div>
                        <div>
                          <label class="block text-xs text-gray-600 dark:text-slate-400 mb-1">Months</label>
                          <input v-model.number="address.time_at_address_months" type="number" min="0" max="11" required
                            placeholder="0"
                            class="block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:text-white"
                            @input="updateAddressHistory" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <button v-if="totalAddressHistoryInMonths < 36" type="button" @click="addPreviousAddress"
                  class="px-4 py-2 text-sm font-semibold text-white bg-primary hover:bg-primary/90 rounded-md">
                  Add Another Previous Address
                </button>

                <!-- Address History Requirement Counter - Fixed at Bottom -->
                <div class="mt-6 p-4 rounded-lg"
                  :class="totalAddressHistoryInMonths >= 36 ? 'bg-green-50 border-2 border-green-500' : 'bg-orange-50 border-2 border-orange-500'">
                  <div class="flex items-center justify-between">
                    <div>
                      <p class="font-semibold"
                        :class="totalAddressHistoryInMonths >= 36 ? 'text-green-900' : 'text-orange-900'">
                        3 Year Address History Requirement
                      </p>
                      <p class="text-sm mt-1"
                        :class="totalAddressHistoryInMonths >= 36 ? 'text-green-700' : 'text-orange-700'">
                        Total: {{ Math.floor(totalAddressHistoryInMonths / 12) }} years {{ totalAddressHistoryInMonths %
                        12 }} months
                        ({{ totalAddressHistoryInMonths }} of 36 months required)
                      </p>
                    </div>
                    <div class="text-3xl">
                      <span v-if="totalAddressHistoryInMonths >= 36" class="text-green-600">✓</span>
                      <span v-else class="text-orange-600">⚠</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- PAGE 5: Proof of Address -->
          <div v-if="currentPage === 5" class="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
            <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">Proof of Address</h2>
            <p class="text-sm text-gray-600 dark:text-slate-400 mb-6">Bank Statement, Utility bill or UK Driving License</p>

            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Upload Document *</label>
                <input ref="proofOfAddressInput" type="file" @change="handleProofOfAddressUpload"
                  accept=".pdf,.jpg,.jpeg,.png" class="hidden" />
                <button type="button" @click="($refs.proofOfAddressInput as any).click()"
                  class="px-4 py-2 text-sm font-semibold bg-blue-50 rounded-md hover:bg-blue-100"
                  :style="{ color: buttonColor }">
                  {{ proofOfAddress ? 'Change File' : 'Choose File' }}
                </button>
                <p class="mt-1 text-xs text-gray-500 dark:text-slate-400">Upload PDF or image (max 10MB)</p>
                <div v-if="proofOfAddress" class="mt-2 p-3 bg-gray-50 dark:bg-slate-700 rounded">
                  <div class="flex items-center justify-between">
                    <span class="text-sm text-gray-700 dark:text-slate-300">{{ proofOfAddress.name }} ({{
                      formatFileSize(proofOfAddress.size) }})</span>
                    <button type="button" @click="removeProofOfAddress" class="text-red-600 hover:text-red-800">
                      <X class="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div v-else-if="formData.proof_of_address_path"
                  class="mt-2 p-3 bg-green-50 dark:bg-green-900/30 rounded border border-green-200 dark:border-green-800">
                  <div class="flex items-center">
                    <Check class="w-4 h-4 text-green-600 mr-2" />
                    <span class="text-sm text-green-700 dark:text-green-400">Proof of address uploaded successfully</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- PAGE 6: Financial Information -->
          <div v-if="currentPage === 6" class="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
            <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">Financial Information</h2>
            <p class="text-sm text-gray-600 dark:text-slate-400 mb-6">Please select all sources of income that apply to you</p>

            <div class="space-y-6">
              <!-- Income Sources -->
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-3">Income Sources *</label>
                <div class="space-y-2">
                  <label class="flex items-center">
                    <input v-model="formData.income_regular_employment" type="checkbox"
                      class="h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-slate-600 rounded" />
                    <span class="ml-2 text-sm text-gray-700 dark:text-slate-300">Employed</span>
                  </label>
                  <label class="flex items-center">
                    <input v-model="formData.income_self_employed" type="checkbox"
                      class="h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-slate-600 rounded" />
                    <span class="ml-2 text-sm text-gray-700 dark:text-slate-300">Self Employed</span>
                  </label>
                  <label class="flex items-center">
                    <input v-model="formData.income_benefits" type="checkbox"
                      class="h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-slate-600 rounded" />
                    <span class="ml-2 text-sm text-gray-700 dark:text-slate-300">Benefits</span>
                  </label>
                  <label class="flex items-center">
                    <input v-model="formData.income_savings_pension_investments" type="checkbox"
                      class="h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-slate-600 rounded" />
                    <span class="ml-2 text-sm text-gray-700 dark:text-slate-300">Savings & Investments</span>
                  </label>
                  <label class="flex items-center">
                    <input v-model="formData.income_pension" type="checkbox"
                      class="h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-slate-600 rounded" />
                    <span class="ml-2 text-sm text-gray-700 dark:text-slate-300">Pension Income</span>
                  </label>
                  <label class="flex items-center">
                    <input v-model="formData.income_landlord_rental" type="checkbox"
                      class="h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-slate-600 rounded" />
                    <span class="ml-2 text-sm text-gray-700 dark:text-slate-300">Landlord/Rental Income</span>
                  </label>
                  <label class="flex items-center">
                    <input v-model="formData.income_student" type="checkbox"
                      class="h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-slate-600 rounded" />
                    <span class="ml-2 text-sm text-gray-700 dark:text-slate-300">Student</span>
                  </label>
                  <label class="flex items-center">
                    <input v-model="formData.income_unemployed" type="checkbox"
                      class="h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-slate-600 rounded" />
                    <span class="ml-2 text-sm text-gray-700 dark:text-slate-300">Unemployed</span>
                  </label>
                </div>
              </div>

              <!-- Guarantor Option (shown if Student or Unemployed is selected) -->
              <div v-if="formData.income_student || formData.income_unemployed" class="pt-6 border-t border-gray-200 dark:border-slate-700">
                <!-- Show existing guarantor message if one exists -->
                <div v-if="hasExistingGuarantor" class="bg-green-50 border-l-4 border-green-500 p-4 mb-4">
                  <div class="flex items-start">
                    <CheckCircle class="w-5 h-5 text-green-600 mr-3 flex-shrink-0 mt-0.5" />
                    <div>
                      <p class="text-sm font-medium text-green-900 mb-1">Guarantor Already Added</p>
                      <p class="text-sm text-green-800">
                        A guarantor has already been added for your reference: <strong>{{ existingGuarantor.firstName }}
                          {{ existingGuarantor.lastName }}</strong> ({{ existingGuarantor.email }})
                      </p>
                      <p class="text-xs text-green-700 mt-2">
                        They will receive an email to complete their guarantor reference form.
                      </p>
                    </div>
                  </div>
                </div>

                <!-- Show guarantor option if no existing guarantor -->
                <template v-else>
                  <div class="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4">
                    <p class="text-sm text-blue-900">
                      As a {{ formData.income_student ? 'student' : 'unemployed person' }}, you may wish to provide a
                      guarantor to support your application.
                    </p>
                  </div>

                  <div class="mb-4">
                    <label class="flex items-center">
                      <input v-model="formData.requires_guarantor" type="checkbox"
                        class="h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-slate-600 rounded" />
                      <span class="ml-2 text-sm font-medium text-gray-700 dark:text-slate-300">I would like to use a guarantor</span>
                    </label>
                  </div>
                </template>

                <!-- Guarantor Details (shown if guarantor is selected AND no existing guarantor) -->
                <div v-if="formData.requires_guarantor && !hasExistingGuarantor"
                  class="space-y-4 pl-6 border-l-2 border-gray-200 dark:border-slate-600">
                  <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Guarantor Details</h3>

                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label for="guarantor-first-name" class="block text-sm font-medium text-gray-700 dark:text-slate-300">Guarantor First
                        Name *</label>
                      <input id="guarantor-first-name" v-model="formData.guarantor_first_name" type="text"
                        :required="formData.requires_guarantor"
                        class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:text-white" />
                    </div>

                    <div>
                      <label for="guarantor-last-name" class="block text-sm font-medium text-gray-700 dark:text-slate-300">Guarantor Last
                        Name *</label>
                      <input id="guarantor-last-name" v-model="formData.guarantor_last_name" type="text"
                        :required="formData.requires_guarantor"
                        class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:text-white" />
                    </div>
                  </div>

                  <div>
                    <label for="guarantor-email" class="block text-sm font-medium text-gray-700 dark:text-slate-300">Guarantor Email Address
                      *</label>
                    <EmailInput id="guarantor-email" v-model="formData.guarantor_email"
                      :required="formData.requires_guarantor"
                      input-class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:text-white" />
                  </div>

                  <PhoneInput v-model="formData.guarantor_phone" label="Guarantor Phone Number" id="guarantor-phone"
                    :required="formData.requires_guarantor"
                    select-class="px-3 py-2 bg-white border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                    input-class="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-md focus:ring-primary focus:border-primary" />

                  <div>
                    <label for="guarantor-relationship" class="block text-sm font-medium text-gray-700 dark:text-slate-300">Relationship to
                      You *</label>
                    <select id="guarantor-relationship" v-model="formData.guarantor_relationship"
                      :required="formData.requires_guarantor"
                      class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:text-white">
                      <option value="">Select relationship</option>
                      <option value="parent">Parent</option>
                      <option value="guardian">Guardian</option>
                      <option value="spouse">Spouse/Partner</option>
                      <option value="sibling">Sibling</option>
                      <option value="relative">Other Relative</option>
                      <option value="friend">Friend</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div class="bg-blue-50 border-l-4 border-blue-400 p-4">
                    <p class="text-sm text-blue-800 mb-2">
                      <strong>What happens next:</strong>
                    </p>
                    <p class="text-sm text-blue-800">
                      Your guarantor will receive an email with a secure link to complete a dedicated guarantor
                      reference form. This form will collect their financial information, employment details, and
                      supporting documents.
                    </p>
                  </div>
                </div>
              </div>

              <!-- Employment Details (shown if Regular Employment is selected) -->
              <div v-if="formData.income_regular_employment" class="pt-6 border-t border-gray-200 dark:border-slate-700">
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Employment Details</h3>

                <div class="space-y-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Employment Type *</label>
                    <select v-model="formData.employment_contract_type" :required="formData.income_regular_employment"
                      class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:text-white">
                      <option value="">Select an option</option>
                      <option value="full-time">Full-time</option>
                      <option value="part-time">Part-time</option>
                      <option value="contract">Contract</option>
                      <option value="temporary">Temporary</option>
                      <option value="zero-hours">Zero Hours</option>
                    </select>
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Employment Start Date *</label>
                    <div class="grid grid-cols-3 gap-3">
                      <div>
                        <select v-model="employmentStartDay" :required="formData.income_regular_employment"
                          class="block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:text-white">
                          <option value="">Day</option>
                          <option v-for="day in 31" :key="day" :value="day">{{ day }}</option>
                        </select>
                      </div>
                      <div>
                        <select v-model="employmentStartMonth" :required="formData.income_regular_employment"
                          class="block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:text-white">
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
                        <select v-model="employmentStartYear" :required="formData.income_regular_employment"
                          class="block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:text-white">
                          <option value="">Year</option>
                          <option v-for="year in employmentYearRange" :key="year" :value="year">{{ year }}</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <!-- Employment End Date (for previous employment) -->
                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                      Employment End Date
                    </label>
                    <input v-model="formData.employment_end_date" type="date"
                      class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:text-white" />
                    <p class="mt-1 text-xs text-gray-500 dark:text-slate-400">
                      Leave blank if current employment
                    </p>
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Compensation Structure *</label>
                    <div class="space-y-2">
                      <label class="flex items-center">
                        <input v-model="formData.employment_is_hourly" type="radio" :value="true" :name="'compensation'"
                          class="h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-slate-600" />
                        <span class="ml-2 text-sm text-gray-700 dark:text-slate-300">Hourly</span>
                      </label>
                      <label class="flex items-center">
                        <input v-model="formData.employment_is_hourly" type="radio" :value="false"
                          :name="'compensation'" class="h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-slate-600" />
                        <span class="ml-2 text-sm text-gray-700 dark:text-slate-300">Salary</span>
                      </label>
                    </div>
                  </div>

                  <div v-if="formData.employment_is_hourly" class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Hourly Rate (£) *</label>
                      <input v-model="formData.employment_salary_amount" type="number" step="0.01"
                        :required="formData.income_regular_employment && formData.employment_is_hourly"
                        class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:text-white" />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Hours per Month *</label>
                      <input v-model="formData.employment_hours_per_month" type="number"
                        :required="formData.income_regular_employment && formData.employment_is_hourly"
                        class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:text-white" />
                    </div>
                  </div>

                  <div v-else>
                    <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Annual Salary (£) *</label>
                    <input v-model="formData.employment_salary_amount" type="number" step="0.01"
                      :required="formData.income_regular_employment && !formData.employment_is_hourly"
                      class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:text-white" />
                  </div>

                  <!-- Salary Payment Frequency -->
                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                      How Often Are You Paid? *
                    </label>
                    <select v-model="formData.employment_salary_frequency"
                      :required="formData.income_regular_employment"
                      class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:text-white">
                      <option value="">Select frequency...</option>
                      <option value="weekly">Weekly</option>
                      <option value="bi-weekly">Bi-weekly (Every 2 weeks)</option>
                      <option value="monthly">Monthly</option>
                      <option value="annually">Annually</option>
                    </select>
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Company Name *</label>
                    <input v-model="formData.employment_company_name" type="text"
                      :required="formData.income_regular_employment"
                      class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:text-white" />
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Job Title *</label>
                    <input v-model="formData.employment_job_title" type="text"
                      :required="formData.income_regular_employment"
                      class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:text-white" />
                  </div>

                  <div>
                    <AddressAutocomplete v-model="formData.employment_company_address_line1"
                      label="Company Address Line 1" :required="formData.income_regular_employment"
                      placeholder="Start typing address..." @addressSelected="handleCompanyAddressSelected"
                      :allowManualEntry="true" />
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Company Address Line 2</label>
                    <input v-model="formData.employment_company_address_line2" type="text"
                      class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:text-white" />
                  </div>

                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Company City *</label>
                      <input v-model="formData.employment_company_city" type="text"
                        :required="formData.income_regular_employment"
                        class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:text-white" />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Company Postcode *</label>
                      <input v-model="formData.employment_company_postcode" type="text"
                        :required="formData.income_regular_employment"
                        class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:text-white" />
                    </div>
                  </div>

                  <div class="relative">
                    <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Company Country *</label>
                    <input v-model="companyCountrySearch" @focus="showCompanyCountryDropdown = true"
                      @input="showCompanyCountryDropdown = true" @blur="hideCompanyCountryDropdown" type="text"
                      :required="formData.income_regular_employment" placeholder="Search and select country..."
                      autocomplete="off"
                      class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:text-white" />
                    <div v-if="showCompanyCountryDropdown && filteredCompanyCountries.length > 0"
                      class="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-md shadow-lg max-h-60 overflow-auto">
                      <div v-for="country in filteredCompanyCountries" :key="country?.code || ''"
                        @mousedown.prevent="country && selectCompanyCountry(country)"
                        class="px-3 py-2 hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer text-sm dark:text-slate-300">
                        {{ country?.name }}
                      </div>
                    </div>
                  </div>

                  <!-- Payslips Upload -->
                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Payslips (Last 3 months) (Optional) -
                      but will speed your reference up drastically</label>
                    <input ref="payslipInput" type="file" @change="handlePayslipUpload" accept=".pdf,.jpg,.jpeg,.png"
                      multiple class="hidden" />
                    <button type="button" @click="($refs.payslipInput as any).click()"
                      class="px-4 py-2 text-sm font-semibold bg-blue-50 rounded-md hover:bg-blue-100"
                      :style="{ color: buttonColor }">
                      Choose Files
                    </button>
                    <p class="mt-1 text-xs text-gray-500 dark:text-slate-400">Upload PDF or images (max 10MB per file)</p>
                    <div v-if="payslips.length > 0" class="mt-2 space-y-1">
                      <div v-for="(file, index) in payslips" :key="index"
                        class="flex items-center justify-between text-sm text-gray-600 dark:text-slate-400 bg-gray-50 dark:bg-slate-700 px-3 py-2 rounded">
                        <span>{{ file.name }} ({{ formatFileSize(file.size) }})</span>
                        <button type="button" @click="removePayslip(index)" class="text-red-600 hover:text-red-800">
                          <X class="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div v-else-if="formData.payslip_paths.length > 0"
                      class="mt-2 p-3 bg-green-50 dark:bg-green-900/30 rounded border border-green-200 dark:border-green-800">
                      <div class="flex items-center">
                        <Check class="w-4 h-4 text-green-600 mr-2" />
                        <span class="text-sm text-green-700">{{ formData.payslip_paths.length }} payslip(s) uploaded
                          successfully</span>
                      </div>
                    </div>
                  </div>

                  <!-- Employer Reference Contact -->
                  <div class="pt-4 border-t border-gray-200 dark:border-slate-700">
                    <h4 class="text-md font-semibold text-gray-900 dark:text-white mb-3">Employer Reference Contact</h4>
                    <div class="space-y-4">
                      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Position *</label>
                          <input v-model="formData.employer_ref_position" type="text"
                            :required="formData.income_regular_employment" placeholder="e.g. HR Manager"
                            class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:text-white" />
                        </div>
                        <div>
                          <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Name *</label>
                          <input v-model="formData.employer_ref_name" type="text"
                            :required="formData.income_regular_employment"
                            class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:text-white" />
                        </div>
                      </div>
                      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Email *</label>
                          <EmailInput v-model="formData.employer_ref_email"
                            :required="formData.income_regular_employment"
                            input-class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:text-white"
                            :class="{ 'border-red-500': employerEmailError }" />
                          <p v-if="employerEmailError" class="mt-1 text-sm text-red-600">{{ employerEmailError }}</p>
                        </div>
                        <PhoneInput v-model="formData.employer_ref_phone" label="Phone" id="employer-ref-phone"
                          :required="formData.income_regular_employment" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Business Details (shown if Self Employed is selected) -->
              <div v-if="formData.income_self_employed" class="pt-6 border-t border-gray-200 dark:border-slate-700">
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Business Details</h3>

                <div class="space-y-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Business Name *</label>
                    <input v-model="formData.self_employed_business_name" type="text"
                      :required="formData.income_self_employed"
                      class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:text-white" />
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Business Start Date *</label>
                    <DatePicker v-model="formData.self_employed_start_date" :required="formData.income_self_employed"
                      year-range-type="employment" />
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Nature of Business *</label>
                    <input v-model="formData.self_employed_nature_of_business" type="text"
                      :required="formData.income_self_employed" placeholder="e.g. Freelance Graphic Design"
                      class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:text-white" />
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Annual Income (£) *</label>
                    <input v-model="formData.self_employed_annual_income" type="number" step="0.01"
                      :required="formData.income_self_employed"
                      class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:text-white" />
                  </div>

                  <!-- Accountant Contact -->
                  <div class="pt-4 border-t border-gray-200 dark:border-slate-700">
                    <h4 class="text-md font-semibold text-gray-900 dark:text-white mb-3">Accountant Contact</h4>
                    <div class="space-y-4">
                      <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Accountant/Firm Name *</label>
                        <input v-model="formData.accountant_name" type="text" :required="formData.income_self_employed"
                          class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:text-white" />
                      </div>
                      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Contact Name *</label>
                          <input v-model="formData.accountant_contact_name" type="text"
                            :required="formData.income_self_employed"
                            class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:text-white" />
                        </div>
                        <div>
                          <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Email *</label>
                          <EmailInput v-model="formData.accountant_email"
                            :required="formData.income_self_employed"
                            input-class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:text-white"
                            :class="{ 'border-red-500': accountantEmailError }" />
                          <p v-if="accountantEmailError" class="mt-1 text-sm text-red-600">{{ accountantEmailError }}
                          </p>
                        </div>
                      </div>
                      <PhoneInput v-model="formData.accountant_phone" label="Phone" id="accountant-phone"
                        :required="formData.income_self_employed" />
                    </div>
                  </div>

                  <!-- Tax Return Upload -->
                  <div class="pt-4 border-t border-gray-200 dark:border-slate-700">
                    <h4 class="text-md font-semibold text-gray-900 dark:text-white mb-3">Tax Return Statement</h4>
                    <div class="space-y-4">
                      <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Upload Most Recent Tax Return ({{
                          currentTaxYear }}) *</label>
                        <input ref="taxReturnInput" type="file" @change="handleTaxReturnUpload"
                          accept=".pdf,.jpg,.jpeg,.png" class="hidden" />
                        <button type="button" @click="($refs.taxReturnInput as any).click()"
                          class="px-4 py-2 text-sm font-semibold bg-blue-50 rounded-md hover:bg-blue-100"
                          :style="{ color: buttonColor }">
                          {{ taxReturn ? 'Change File' : 'Upload Tax Return' }}
                        </button>
                        <p class="mt-1 text-xs text-gray-500 dark:text-slate-400">Upload your most recent tax return statement (max 10MB,
                          PDF or image)</p>

                        <div v-if="taxReturn" class="mt-4 p-3 bg-gray-50 dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
                          <div class="flex items-center justify-between">
                            <span class="text-sm text-gray-700 dark:text-slate-300">{{ taxReturn.name }} ({{ formatFileSize(taxReturn.size)
                              }})</span>
                            <button type="button" @click="removeTaxReturn"
                              class="text-red-600 hover:text-red-800 text-sm">
                              Remove
                            </button>
                          </div>
                        </div>
                        <div v-else-if="formData.tax_return_path"
                          class="mt-2 p-3 bg-green-50 dark:bg-green-900/30 rounded border border-green-200 dark:border-green-800">
                          <div class="flex items-center">
                            <Check class="w-4 h-4 text-green-600 mr-2" />
                            <span class="text-sm text-green-700 dark:text-green-400">Tax return uploaded successfully</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Benefits Details (shown if selected) -->
              <div v-if="formData.income_benefits" class="pt-6 border-t border-gray-200 dark:border-slate-700">
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Benefits Details</h3>

                <div class="space-y-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Monthly Benefits Amount (£) *</label>
                    <input v-model.number="formData.benefits_monthly_amount" type="number" step="0.01" min="0"
                      :required="formData.income_benefits" placeholder="Enter monthly benefits amount"
                      class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:text-white" />
                    <p class="mt-1 text-xs text-gray-500 dark:text-slate-400">Enter the total amount you receive in benefits each month</p>
                  </div>

                  <div v-if="benefitsAnnualAmount > 0" class="p-3 bg-blue-50 dark:bg-blue-900/30 rounded border border-blue-200 dark:border-blue-800">
                    <p class="text-sm text-gray-700 dark:text-slate-300">
                      <span class="font-semibold">Annual Benefits:</span> £{{
                      benefitsAnnualAmount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2
                      }) }}
                    </p>
                  </div>
                </div>
              </div>

              <!-- Savings & Investments Details (shown if selected) -->
              <div v-if="formData.income_savings_pension_investments" class="pt-6 border-t border-gray-200 dark:border-slate-700">
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Savings & Investments Details</h3>

                <div class="space-y-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Total Savings Amount (£) *</label>
                    <input v-model.number="formData.savings_amount" type="number" step="0.01" min="0"
                      :required="formData.income_savings_pension_investments"
                      placeholder="Enter total amount in savings"
                      class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:text-white" />
                    <p class="mt-1 text-xs text-gray-500 dark:text-slate-400">Include savings and investment values</p>
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Proof of Funds *</label>
                    <input ref="proofOfFundsInput" type="file" @change="handleProofOfFundsUpload"
                      accept=".pdf,.jpg,.jpeg,.png" class="hidden" />
                    <button type="button" @click="($refs.proofOfFundsInput as any).click()"
                      class="px-4 py-2 text-sm font-semibold bg-blue-50 rounded-md hover:bg-blue-100"
                      :style="{ color: buttonColor }">
                      {{ proofOfFunds ? 'Change Document' : 'Upload Document' }}
                    </button>
                    <p class="mt-1 text-xs text-gray-500 dark:text-slate-400">Upload bank statement or investment portfolio statement (max 10MB, PDF/JPG/PNG)</p>
                    <div class="mt-2 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-md border border-blue-200 dark:border-blue-800">
                      <p class="text-xs text-blue-800 dark:text-blue-300">
                        <strong>Tip:</strong> Your statement only needs to display the inbound income/deposits. You may redact other transaction details for privacy. Alternatively, you can upload payslips if you have regular employment income.
                      </p>
                    </div>
                    <div v-if="proofOfFunds" class="mt-4 p-3 bg-gray-50 dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
                      <div class="flex items-center justify-between">
                        <div class="flex items-center">
                          <FileText class="w-5 h-5 text-blue-600 mr-2" />
                          <span class="text-sm text-gray-700 dark:text-slate-300">{{ proofOfFunds.name }} ({{
                            formatFileSize(proofOfFunds.size) }})</span>
                        </div>
                        <button type="button" @click="removeProofOfFunds"
                          class="text-red-600 hover:text-red-800 text-sm">
                          Remove
                        </button>
                      </div>
                    </div>
                    <div v-else-if="formData.proof_of_funds_path"
                      class="mt-2 p-3 bg-green-50 dark:bg-green-900/30 rounded border border-green-200 dark:border-green-800">
                      <div class="flex items-center">
                        <Check class="w-4 h-4 text-green-600 mr-2" />
                        <span class="text-sm text-green-700 dark:text-green-400">Proof of funds uploaded successfully</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Pension Income Details (shown if selected) -->
              <div v-if="formData.income_pension" class="pt-6 border-t border-gray-200 dark:border-slate-700">
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Pension Income Details</h3>

                <div class="space-y-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Monthly Pension Amount (£) *</label>
                    <input v-model.number="formData.pension_monthly_amount" type="number" step="0.01" min="0"
                      :required="formData.income_pension"
                      placeholder="Enter monthly pension amount"
                      class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:text-white" />
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Pension Provider *</label>
                    <input v-model="formData.pension_provider" type="text"
                      :required="formData.income_pension"
                      placeholder="e.g., State Pension, Scottish Widows, Aviva"
                      class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:text-white" />
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Pension Statement *</label>
                    <input ref="pensionStatementInput" type="file" @change="handlePensionStatementUpload"
                      accept=".pdf,.jpg,.jpeg,.png" class="hidden" />
                    <button type="button" @click="($refs.pensionStatementInput as any).click()"
                      class="px-4 py-2 text-sm font-semibold bg-blue-50 rounded-md hover:bg-blue-100"
                      :style="{ color: buttonColor }">
                      {{ pensionStatement ? 'Change Document' : 'Upload Document' }}
                    </button>
                    <p class="mt-1 text-xs text-gray-500 dark:text-slate-400">Upload your most recent pension statement (max 10MB, PDF/JPG/PNG)</p>
                    <div v-if="pensionStatement" class="mt-4 p-3 bg-gray-50 dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
                      <div class="flex items-center justify-between">
                        <div class="flex items-center">
                          <FileText class="w-5 h-5 text-blue-600 mr-2" />
                          <span class="text-sm text-gray-700 dark:text-slate-300">{{ pensionStatement.name }} ({{
                            formatFileSize(pensionStatement.size) }})</span>
                        </div>
                        <button type="button" @click="removePensionStatement"
                          class="text-red-600 hover:text-red-800 text-sm">
                          Remove
                        </button>
                      </div>
                    </div>
                    <div v-else-if="formData.pension_statement_path"
                      class="mt-2 p-3 bg-green-50 dark:bg-green-900/30 rounded border border-green-200 dark:border-green-800">
                      <div class="flex items-center">
                        <Check class="w-4 h-4 text-green-600 mr-2" />
                        <span class="text-sm text-green-700 dark:text-green-400">Pension statement uploaded successfully</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Landlord/Rental Income Details (shown if selected) -->
              <div v-if="formData.income_landlord_rental" class="pt-6 border-t border-gray-200 dark:border-slate-700">
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Landlord/Rental Income Details</h3>

                <div class="space-y-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Monthly Rental Income (£) *</label>
                    <input v-model.number="formData.landlord_rental_monthly_amount" type="number" step="0.01" min="0"
                      :required="formData.income_landlord_rental"
                      placeholder="Enter monthly rental income"
                      class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:text-white" />
                    <p class="mt-1 text-xs text-gray-500 dark:text-slate-400">Total monthly income from property rentals</p>
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Bank Statement *</label>
                    <input ref="landlordRentalBankStatementInput" type="file" @change="handleLandlordRentalBankStatementUpload"
                      accept=".pdf,.jpg,.jpeg,.png" class="hidden" />
                    <button type="button" @click="($refs.landlordRentalBankStatementInput as any).click()"
                      class="px-4 py-2 text-sm font-semibold bg-blue-50 rounded-md hover:bg-blue-100"
                      :style="{ color: buttonColor }">
                      {{ landlordRentalBankStatement ? 'Change Document' : 'Upload Document' }}
                    </button>
                    <p class="mt-1 text-xs text-gray-500 dark:text-slate-400">Upload bank statement showing rental income deposits (max 10MB, PDF/JPG/PNG)</p>
                    <div class="mt-2 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-md border border-blue-200 dark:border-blue-800">
                      <p class="text-xs text-blue-800 dark:text-blue-300">
                        <strong>Tip:</strong> Your statement only needs to display the inbound rental income deposits. You may redact other transaction details for privacy.
                      </p>
                    </div>
                    <div v-if="landlordRentalBankStatement" class="mt-4 p-3 bg-gray-50 dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
                      <div class="flex items-center justify-between">
                        <div class="flex items-center">
                          <FileText class="w-5 h-5 text-blue-600 mr-2" />
                          <span class="text-sm text-gray-700 dark:text-slate-300">{{ landlordRentalBankStatement.name }} ({{
                            formatFileSize(landlordRentalBankStatement.size) }})</span>
                        </div>
                        <button type="button" @click="removeLandlordRentalBankStatement"
                          class="text-red-600 hover:text-red-800 text-sm">
                          Remove
                        </button>
                      </div>
                    </div>
                    <div v-else-if="formData.landlord_rental_bank_statement_path"
                      class="mt-2 p-3 bg-green-50 dark:bg-green-900/30 rounded border border-green-200 dark:border-green-800">
                      <div class="flex items-center">
                        <Check class="w-4 h-4 text-green-600 mr-2" />
                        <span class="text-sm text-green-700 dark:text-green-400">Bank statement uploaded successfully</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- PAGE 7: Additional Income or Savings -->
          <div v-if="currentPage === 7" class="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
            <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">Additional Income or Savings</h2>
            <p class="text-sm text-gray-600 dark:text-slate-400 mb-6">Do you have any additional sources of income or savings to supplement
              your application?</p>

            <div class="space-y-4">
              <div>
                <label class="flex items-center">
                  <input v-model="formData.has_additional_income" type="checkbox"
                    class="h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-slate-600 rounded" />
                  <span class="ml-2 text-sm text-gray-700 dark:text-slate-300">Yes, I have additional income or savings</span>
                </label>
                <p class="mt-2 text-xs text-gray-500 dark:text-slate-400 ml-6">Leave unchecked if you do not have additional income or
                  savings</p>
              </div>

              <div v-if="formData.has_additional_income" class="space-y-4 pt-4">
                <!-- Type Selection: Income or Savings -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-3">Type *</label>
                  <div class="flex gap-4">
                    <label class="flex items-center">
                      <input v-model="formData.additional_income_type" type="radio" value="income"
                        :required="formData.has_additional_income"
                        class="h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-slate-600" />
                      <span class="ml-2 text-sm text-gray-700 dark:text-slate-300">Additional Income</span>
                    </label>
                    <label class="flex items-center">
                      <input v-model="formData.additional_income_type" type="radio" value="savings"
                        :required="formData.has_additional_income"
                        class="h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-slate-600" />
                      <span class="ml-2 text-sm text-gray-700 dark:text-slate-300">Savings</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">
                    {{ formData.additional_income_type === 'savings' ? 'Source of Savings' : 'Source of Additional Income' }} *
                  </label>
                  <input v-model="formData.additional_income_source" type="text"
                    :required="formData.has_additional_income"
                    :placeholder="formData.additional_income_type === 'savings' ? 'e.g. Savings account, investments, ISA, etc.' : 'e.g. Freelance work, rental income, dividends, etc.'"
                    class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:text-white" />
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">
                      {{ formData.additional_income_type === 'savings' ? 'Total Amount (£)' : 'Amount (£)' }} *
                    </label>
                    <input v-model="formData.additional_income_amount" type="number" step="0.01"
                      :required="formData.has_additional_income"
                      class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:text-white" />
                  </div>
                  <div v-if="formData.additional_income_type === 'income'">
                    <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Frequency *</label>
                    <select v-model="formData.additional_income_frequency"
                      :required="formData.additional_income_type === 'income'"
                      class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:text-white">
                      <option value="">Select frequency</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="annually">Annually</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Proof of Additional Income or Savings
                    *</label>
                  <input ref="proofOfAdditionalIncomeInput" type="file" @change="handleProofOfAdditionalIncomeUpload"
                    accept=".pdf,.jpg,.jpeg,.png" class="hidden" />
                  <button type="button" @click="($refs.proofOfAdditionalIncomeInput as any).click()"
                    class="px-4 py-2 text-sm font-semibold bg-blue-50 rounded-md hover:bg-blue-100"
                    :style="{ color: buttonColor }">
                    {{ proofOfAdditionalIncome ? 'Change Document' : 'Upload Document' }}
                  </button>
                  <p class="mt-1 text-xs text-gray-500 dark:text-slate-400">Upload proof such as bank statements, savings account
                    statements, investment portfolios, invoices, contracts, etc. (max 10MB, PDF/JPG/PNG)</p>
                  <div class="mt-2 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-md border border-blue-200 dark:border-blue-800">
                    <p class="text-xs text-blue-800 dark:text-blue-300">
                      <strong>Tip:</strong> If uploading a bank statement, it only needs to display the inbound income. You may redact other transaction details for privacy.
                    </p>
                  </div>
                  <div v-if="proofOfAdditionalIncome" class="mt-4 p-3 bg-gray-50 dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
                    <div class="flex items-center justify-between">
                      <div class="flex items-center">
                        <FileText class="w-5 h-5 text-blue-600 mr-2" />
                        <span class="text-sm text-gray-700 dark:text-slate-300">{{ proofOfAdditionalIncome.name }} ({{
                          formatFileSize(proofOfAdditionalIncome.size) }})</span>
                      </div>
                      <button type="button" @click="removeProofOfAdditionalIncome"
                        class="text-red-600 hover:text-red-800 text-sm">
                        Remove
                      </button>
                    </div>
                  </div>
                  <div v-else-if="formData.proof_of_additional_income_path"
                    class="mt-2 p-3 bg-green-50 dark:bg-green-900/30 rounded border border-green-200 dark:border-green-800">
                    <div class="flex items-center">
                      <Check class="w-4 h-4 text-green-600 mr-2" />
                      <span class="text-sm text-green-700 dark:text-green-400">Proof of additional income uploaded successfully</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- PAGE 8: Adverse Credit -->
          <div v-if="currentPage === 8" class="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
            <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">Adverse Credit</h2>
            <p class="text-sm text-gray-600 dark:text-slate-400 mb-6">Do you have any personal adverse credit history?</p>

            <div class="space-y-4">
              <div>
                <label class="flex items-center">
                  <input v-model="formData.has_adverse_credit" type="checkbox"
                    class="h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-slate-600 rounded" />
                  <span class="ml-2 text-sm text-gray-700 dark:text-slate-300">Yes, I have adverse credit</span>
                </label>
                <p class="mt-2 text-xs text-gray-500 dark:text-slate-400 ml-6">Leave unchecked if you do not have adverse credit history</p>
              </div>

              <div v-if="formData.has_adverse_credit" class="pt-4">
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Please provide details *</label>
                <textarea v-model="formData.adverse_credit_details" :required="formData.has_adverse_credit" rows="4"
                  placeholder="Please explain any CCJs, defaults, bankruptcies, or other adverse credit events..."
                  class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:text-white"></textarea>
              </div>
            </div>
          </div>

          <!-- PAGE 9: Tenant Details -->
          <div v-if="currentPage === 9" class="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
            <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">About You</h2>
            <p class="text-sm text-gray-600 dark:text-slate-400 mb-6">Please provide some additional information about yourself</p>

            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Are you a smoker? *</label>
                <div class="space-y-2">
                  <label class="flex items-center">
                    <input v-model="formData.is_smoker" type="radio" :value="true" name="smoker" required
                      class="h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-slate-600" />
                    <span class="ml-2 text-sm text-gray-700 dark:text-slate-300">Yes</span>
                  </label>
                  <label class="flex items-center">
                    <input v-model="formData.is_smoker" type="radio" :value="false" name="smoker" required
                      class="h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-slate-600" />
                    <span class="ml-2 text-sm text-gray-700 dark:text-slate-300">No</span>
                  </label>
                </div>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Do you have any pets?</label>
                <div class="space-y-2">
                  <label class="flex items-center">
                    <input v-model="formData.has_pets" type="checkbox"
                      class="h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-slate-600 rounded" />
                    <span class="ml-2 text-sm text-gray-700 dark:text-slate-300">Yes, I have pets</span>
                  </label>
                  <p class="text-xs text-gray-500 dark:text-slate-400 ml-6">Leave unchecked if you do not have pets</p>
                </div>
                <div v-if="formData.has_pets" class="mt-3">
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Pet Details *</label>
                  <textarea v-model="formData.pet_details" :required="formData.has_pets" rows="3"
                    placeholder="Please describe your pets (type, breed, size, etc.)"
                    class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:text-white"></textarea>
                </div>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Marital Status *</label>
                <select v-model="formData.marital_status" required
                  class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:text-white">
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
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Number of Dependants *</label>
                <input v-model="formData.number_of_dependants" type="number" min="0" required
                  class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:text-white" />
              </div>

              <div v-if="formData.number_of_dependants > 0">
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Dependants Details *</label>
                <textarea v-model="formData.dependants_details" :required="formData.number_of_dependants > 0" rows="3"
                  placeholder="Please provide ages and relationship (e.g. 2 children aged 5 and 7)"
                  class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:text-white"></textarea>
              </div>
            </div>
          </div>

          <!-- PAGE 10: Previous Landlord/Agent Reference -->
          <div v-if="currentPage === 10" class="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
            <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">Previous Rental Reference</h2>
            <p class="text-sm text-gray-600 dark:text-slate-400 mb-6">Please provide details so we can request a reference from your
              previous landlord or letting agent</p>

            <div class="space-y-4">
              <!-- Reference Type Selector -->
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-3">Reference Type *</label>
                <div class="flex gap-4">
                  <label class="flex items-center cursor-pointer">
                    <input type="radio" v-model="formData.reference_type" value="landlord" class="mr-2"
                      :style="{ accentColor: primaryColor }" />
                    <span class="text-sm text-gray-700 dark:text-slate-300">Landlord</span>
                  </label>
                  <label class="flex items-center cursor-pointer">
                    <input type="radio" v-model="formData.reference_type" value="agent" class="mr-2"
                      :style="{ accentColor: primaryColor }" />
                    <span class="text-sm text-gray-700 dark:text-slate-300">Letting Agent</span>
                  </label>
                  <label class="flex items-center cursor-pointer">
                    <input type="radio" v-model="formData.reference_type" value="living_with_family" class="mr-2"
                      :style="{ accentColor: primaryColor }" />
                    <span class="text-sm text-gray-700 dark:text-slate-300">Living with Family</span>
                  </label>
                </div>
              </div>

              <div v-if="formData.reference_type !== 'living_with_family'">
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">{{ formData.reference_type === 'agent' ?
                  "Agent's Full Name" : "Landlord's Full Name" }} *</label>
                <input v-model="formData.previous_landlord_name" type="text" required
                  class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:text-white"
                  :placeholder="formData.reference_type === 'agent' ? 'Enter agent\'s full name' : 'Enter landlord\'s full name'" />
              </div>

              <template v-if="formData.reference_type !== 'living_with_family'">
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">{{ formData.reference_type === 'agent' ?
                    "Agent's Email" : "Landlord's Email" }} *</label>
                  <EmailInput v-model="formData.previous_landlord_email"
                    :required="formData.reference_type !== 'living_with_family'"
                    input-class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:text-white"
                    :class="{ 'border-red-500': landlordEmailError }"
                    :placeholder="formData.reference_type === 'agent' ? 'agent@example.com' : 'landlord@example.com'" />
                  <p v-if="landlordEmailError" class="mt-1 text-sm text-red-600">{{ landlordEmailError }}</p>
                  <p v-else class="mt-1 text-xs text-gray-500 dark:text-slate-400">We will send an email to this address to request a
                    reference</p>
                </div>

                <PhoneInput v-model="formData.previous_landlord_phone"
                  :label="formData.reference_type === 'agent' ? 'Agent\'s Phone Number' : 'Landlord\'s Phone Number'"
                  id="previous-landlord-phone" :required="formData.reference_type !== 'living_with_family'" />

                <div>
                  <h3 class="text-md font-semibold text-gray-700 dark:text-slate-300 mb-3 mt-6">Previous Rental Address</h3>
                </div>

                <div>
                  <AddressAutocomplete v-model="formData.previous_rental_address_line1" label="Address Line 1"
                    :required="formData.reference_type !== 'living_with_family'" placeholder="Start typing address..."
                    @addressSelected="handlePreviousRentalAddressSelected"
                    :allowManualEntry="true" />
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Address Line 2</label>
                  <input v-model="formData.previous_rental_address_line2" type="text"
                    class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:text-white"
                    placeholder="Apartment, suite, etc. (optional)" />
                </div>

                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">City *</label>
                    <input v-model="formData.previous_rental_city" type="text"
                      :required="formData.reference_type !== 'living_with_family'"
                      class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:text-white"
                      placeholder="City" />
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Postcode *</label>
                    <input v-model="formData.previous_rental_postcode" type="text"
                      :required="formData.reference_type !== 'living_with_family'"
                      class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:text-white"
                      placeholder="Postcode" />
                  </div>
                </div>

                <div class="relative">
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Country *</label>
                  <input v-model="previousRentalCountrySearch" @focus="showPreviousRentalCountryDropdown = true"
                    @input="showPreviousRentalCountryDropdown = true" @blur="hidePreviousRentalCountryDropdown"
                    type="text" :required="formData.reference_type !== 'living_with_family'"
                    placeholder="Search and select country..." autocomplete="off"
                    class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:text-white" />
                  <div v-if="showPreviousRentalCountryDropdown && filteredPreviousRentalCountries.length > 0"
                    class="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-md shadow-lg max-h-60 overflow-auto">
                    <div v-for="country in filteredPreviousRentalCountries" :key="country?.code || ''"
                      @mousedown.prevent="country && selectPreviousRentalCountry(country)"
                      class="px-3 py-2 hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer text-sm dark:text-slate-300">
                      {{ country?.name }}
                    </div>
                  </div>
                </div>

                <div>
                  <h3 class="text-md font-semibold text-gray-700 dark:text-slate-300 mb-3 mt-6">Tenancy Duration</h3>
                </div>

                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Tenancy Duration (Years)</label>
                    <input v-model.number="formData.tenancy_years" type="number" min="0"
                      class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:text-white"
                      placeholder="0" />
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Tenancy Duration (Months)</label>
                    <input v-model.number="formData.tenancy_months" type="number" min="0" max="11"
                      class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:text-white"
                      placeholder="0" />
                  </div>
                </div>

                <!-- Previous Monthly Rent -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                    Monthly Rent at Previous Address *
                  </label>
                  <div class="relative">
                    <span class="absolute left-3 top-3 text-gray-500 dark:text-slate-400">£</span>
                    <input v-model.number="formData.previous_monthly_rent" type="number"
                      :required="formData.reference_type !== 'living_with_family'"
                      class="pl-7 mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:text-white"
                      placeholder="800" />
                  </div>
                </div>

                <!-- Previous Tenancy Start Date -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                    Tenancy Start Date *
                  </label>
                  <input v-model="formData.previous_tenancy_start_date" type="date"
                    :required="formData.reference_type !== 'living_with_family'"
                    class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:text-white" />
                </div>

                <!-- Still in Tenancy Checkbox -->
                <div>
                  <label class="flex items-center">
                    <input v-model="formData.previous_tenancy_still_in_progress" type="checkbox"
                      class="h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-slate-600 rounded" />
                    <span class="ml-2 text-sm text-gray-700 dark:text-slate-300">Still in tenancy (no end date yet)</span>
                  </label>
                </div>

                <!-- Previous Tenancy End Date -->
                <div v-if="!formData.previous_tenancy_still_in_progress">
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                    Tenancy End Date *
                  </label>
                  <input v-model="formData.previous_tenancy_end_date" type="date"
                    :required="formData.reference_type !== 'living_with_family' && !formData.previous_tenancy_still_in_progress"
                    class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:text-white" />
                </div>

                <!-- Agency Name (only show if reference_type is 'agent') -->
                <div v-if="formData.reference_type === 'agent'">
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                    Letting Agency Name *
                  </label>
                  <input v-model="formData.previous_agency_name" type="text"
                    :required="formData.reference_type === 'agent'"
                    class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:text-white"
                    placeholder="e.g., Foxtons, Rightmove Lettings" />
                </div>
              </template>

              <div v-if="formData.reference_type === 'living_with_family'"
                class="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <div class="flex">
                  <div class="flex-shrink-0">
                    <CheckCircle class="h-5 w-5 text-green-400" />
                  </div>
                  <div class="ml-3">
                    <p class="text-sm text-green-700 dark:text-green-400">
                      Living with family - no landlord reference required. You can proceed to the next section.
                    </p>
                  </div>
                </div>
              </div>

              <div v-if="formData.reference_type !== 'living_with_family'"
                class="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div class="flex">
                  <div class="flex-shrink-0">
                    <Info class="h-5 w-5 text-blue-400" />
                  </div>
                  <div class="ml-3">
                    <p class="text-sm text-blue-700 dark:text-blue-300">
                      Your previous {{ formData.reference_type === 'agent' ? 'letting agent' : 'landlord' }} will
                      receive an email asking them to provide a reference about your tenancy.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- PAGE 11: Review and Submit -->
          <div v-if="currentPage === 11" class="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
            <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">Referencing Consent</h2>
            <p class="text-sm text-gray-600 dark:text-slate-400 mb-6">Please read and sign the declaration below</p>

            <div class="space-y-6">
              <!-- Declaration Text -->
              <div
                class="bg-gray-50 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg p-4 text-sm text-gray-700 dark:text-slate-300 space-y-3 max-h-96 overflow-y-auto">
                <p>I confirm that all of the information I have provided in this application form is accurate, and to
                  the best of my knowledge true. I consent to all of the information provided being checked and
                  confirmed by fair and lawful means, I understand this will involve Propertygoose Ltd contacting the
                  referees supplied.</p>

                <p>I agree that Propertygoose Ltd will use the information I provide on this application form and any
                  information acquired from relevant sources to process my application for tenancy/to become a Guarantor
                  for a tenancy. I understand that this application and the results of the findings will be forwarded to
                  the instructing letting agent and/or landlord and that this information may be accessed again in the
                  future should I default on my rental payments or payments due as a Guarantor, apply for a new tenancy
                  or if there is a complaint or legal challenge with significance to this process.</p>

                <p>I understand that Propertygoose Ltd will use the services of a credit referencing agency for the
                  purposes of Tenant vetting, identity and anti-money laundering. I understand they will check the
                  details held with this company, and that they will in turn keep a record of that search.</p>

                <p>I understand that the information I am providing in this application form is information as described
                  in ground 17 of the Housing Act 1996, and if any information is found to be untrue then this will be
                  grounds for termination of the tenancy.</p>

                <p>Propertygoose Ltd may also use or forward information to the Police or other law enforcement agencies
                  to prevent or detect crime, such as fraud, or in other circumstances as permitted by law. All
                  information will be treated as confidential and processed in accordance with The Data Protection Act
                  (2018).</p>

                <p>I hereby give authorisation for my EMPLOYER/ACCOUNTANT/PENSION ADMINISTRATOR to provide details of my
                  earnings and dates of employment to Propertygoose Ltd for the benefit of completing this application.
                  It is an offence to misrepresent any information provided in this form.</p>

                <p>I hereby give authorisation for my LANDLORD/LETTING AGENT to provide details of my tenancy, including
                  payment information to Propertygoose Ltd for the benefit of completing this application. It is an
                  offence to misrepresent any information provided in this form.</p>

                <p>By entering/signing your name on this form and submitting the details you confirm you are in
                  agreement to the above terms and conditions and the processing of sensitive personal information. We
                  process and hold all information in accordance with the GDPR (General Data Protection Regulations)
                  2018.</p>

                <p>If you've been asked to upload any supporting documentation you can do so above. You will need to
                  upload a copy of your photo ID (Passport, Driving licence, European ID card), proof of residency (in
                  the form or a recent bank statement or utility bill dated within the last 3 months) and copies of your
                  last 3 months' payslips (if applicable). This will help us to process your application promptly.</p>

                <p>For further information on how we process your data and our privacy policies please visit: <a
                    href="https://propertygoose.co.uk/privacy-policy" target="_blank"
                    class="text-blue-600 hover:underline">https://propertygoose.co.uk/privacy-policy</a></p>
              </div>

              <!-- Signature -->
              <SignaturePad v-model="formData.consent_signature" label="Signature" />

              <!-- Agreed On Date -->
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Agreed On *
                </label>
                <input v-model="formData.consent_agreed_date" type="text" readonly
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-gray-50 dark:bg-slate-700 text-gray-700 dark:text-slate-300" />
              </div>

              <!-- Printed Name -->
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Printed Name *
                </label>
                <input v-model="formData.consent_printed_name" type="text" required placeholder="Print your full name"
                  class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:text-white" />
              </div>
            </div>
          </div>

          <!-- Error Messages -->
          <div v-if="submitError" class="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-6 py-4 rounded-lg">
            {{ submitError }}
          </div>

          <!-- Progress Indicator for Uploads -->
          <div v-if="uploadProgress > 0 && uploadProgress < 100" class="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm text-gray-600 dark:text-slate-400">Uploading files...</span>
              <span class="text-sm text-gray-600 dark:text-slate-400">{{ uploadProgress }}%</span>
            </div>
            <div class="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
              <div class="h-2 rounded-full transition-all duration-300"
                :style="{ width: uploadProgress + '%', backgroundColor: primaryColor }"></div>
            </div>
          </div>

          <!-- Navigation Buttons -->
          <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
            <div class="flex justify-between">
              <button v-if="currentPage > 1" type="button" @click="goToPreviousPage"
                class="px-6 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-md">
                Back
              </button>
              <div v-else></div>

              <button v-if="currentPage < 11" type="submit" :disabled="submitting"
                class="px-6 py-2 text-sm font-medium text-white rounded-md disabled:opacity-50 hover:opacity-90"
                :style="{ backgroundColor: buttonColor }">
                {{ submitting ? 'Uploading...' : 'Next' }}
              </button>
              <button v-else type="submit" :disabled="submitting || !consentGiven"
                class="px-6 py-2 text-sm font-medium text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                :style="{ backgroundColor: buttonColor }">
                {{ submitting ? 'Submitting...' : 'Submit Reference' }}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { CheckCircle, X, Check, Info, FileText } from 'lucide-vue-next'
import PhoneInput from '../components/PhoneInput.vue'
import EmailInput from '../components/EmailInput.vue'
import SignaturePad from '../components/SignaturePad.vue'
import AddressAutocomplete from '../components/AddressAutocomplete.vue'
import DatePicker from '../components/DatePicker.vue'
import DeviceHandoffGate from '../components/DeviceHandoffGate.vue'
import { useGeolocationCapture } from '../composables/useGeolocationCapture'
import { COUNTRIES, POSTCODE_LABELS, POSTCODE_PLACEHOLDERS, CAPITAL_CITIES } from '../utils/countries'
import { formatDate as formatUkDate } from '../utils/date'
import { defaultBranding } from '../config/colors'

const API_URL = import.meta.env.VITE_API_URL ?? ''

const route = useRoute()
const LEGACY_LINK_MESSAGE = "This link has expired. We've sent a new one."
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const isUuid = (value: string) => UUID_REGEX.test(value)

// LocalStorage key for this reference
const getStorageKey = () => `tenant_reference_form_${route.params.token}`
const getDeviceGateStorageKey = () => `${getStorageKey()}_device_gate_ack`

const reference = ref<any>(null)
const initialLoading = ref(true)
const tokenError = ref('')
const submitting = ref(false)
const submitError = ref('')
const justSubmitted = ref(false)
const uploadProgress = ref(0)
const currentPage = ref(1)

const fieldErrors = ref<Record<string, string>>({})

// Email validation errors
const employerEmailError = ref('')
const accountantEmailError = ref('')
const landlordEmailError = ref('')

// Existing guarantor (added by agent)
const existingGuarantor = ref<any>(null)
const hasExistingGuarantor = ref(false)

// Company branding
const companyLogo = ref('')
const primaryColor = ref(defaultBranding.primaryColor)
const buttonColor = ref(defaultBranding.buttonColor)
const showDeviceGate = ref(true)
const deviceLink = ref('')
const { geolocation: userGeolocation } = useGeolocationCapture()

// Nationality search
const nationalitySearch = ref('')
const showNationalityDropdown = ref(false)

// Country search
const countrySearch = ref('')
const showCountryDropdown = ref(false)

// Company Country search
const companyCountrySearch = ref('')
const showCompanyCountryDropdown = ref(false)

// Previous Rental Country search
const previousRentalCountrySearch = ref('')
const showPreviousRentalCountryDropdown = ref(false)

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

// Email domain validation
const isWorkEmail = (email: string): boolean => {
  if (!email || !email.includes('@')) return false

  const freeEmailDomains = [
    'gmail.com', 'googlemail.com',
    'yahoo.com', 'yahoo.co.uk', 'yahoo.co.in', 'yahoo.ca', 'yahoo.com.au',
    'hotmail.com', 'hotmail.co.uk', 'hotmail.fr', 'hotmail.de',
    'outlook.com', 'outlook.co.uk',
    'live.com', 'live.co.uk',
    'aol.com', 'aol.co.uk',
    'icloud.com', 'me.com', 'mac.com',
    'protonmail.com', 'proton.me',
    'mail.com', 'email.com',
    'yandex.com', 'yandex.ru',
    'zoho.com', 'zohomail.com'
  ]

  const domain = email.split('@')[1]?.toLowerCase().trim()
  return domain ? !freeEmailDomains.includes(domain) : false
}

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
    const ukIndex = COUNTRIES.findIndex(c => c.code === 'GB')
    if (ukIndex !== -1) {
      return [COUNTRIES[ukIndex], ...COUNTRIES.filter(c => c.code !== 'GB')]
    }
    return COUNTRIES
  }
  const search = countrySearch.value.toLowerCase()
  const filtered = COUNTRIES.filter(c => c.name.toLowerCase().includes(search))

  // If UK matches the search, show it first
  const ukIndex = filtered.findIndex(c => c.code === 'GB')
  if (ukIndex !== -1) {
    return [filtered[ukIndex], ...filtered.filter(c => c.code !== 'GB')]
  }
  return filtered
})

// Filtered company countries based on search
const filteredCompanyCountries = computed(() => {
  if (!companyCountrySearch.value) {
    // Show United Kingdom first, then all other countries
    const ukIndex = COUNTRIES.findIndex(c => c.code === 'GB')
    if (ukIndex !== -1) {
      return [COUNTRIES[ukIndex], ...COUNTRIES.filter(c => c.code !== 'GB')]
    }
    return COUNTRIES
  }
  const search = companyCountrySearch.value.toLowerCase()
  const filtered = COUNTRIES.filter(c => c.name.toLowerCase().includes(search))

  // If UK matches the search, show it first
  const ukIndex = filtered.findIndex(c => c.code === 'GB')
  if (ukIndex !== -1) {
    return [filtered[ukIndex], ...filtered.filter(c => c.code !== 'GB')]
  }
  return filtered
})

// Filtered previous rental countries based on search
const filteredPreviousRentalCountries = computed(() => {
  if (!previousRentalCountrySearch.value) {
    // Show United Kingdom first, then all other countries
    const ukIndex = COUNTRIES.findIndex(c => c.code === 'GB')
    if (ukIndex !== -1) {
      return [COUNTRIES[ukIndex], ...COUNTRIES.filter(c => c.code !== 'GB')]
    }
    return COUNTRIES
  }
  const search = previousRentalCountrySearch.value.toLowerCase()
  const filtered = COUNTRIES.filter(c => c.name.toLowerCase().includes(search))

  // If UK matches the search, show it first
  const ukIndex = filtered.findIndex(c => c.code === 'GB')
  if (ukIndex !== -1) {
    return [filtered[ukIndex], ...filtered.filter(c => c.code !== 'GB')]
  }
  return filtered
})

// Select nationality from dropdown
const selectNationality = (nationality: string) => {
  nationalitySearch.value = nationality
  formData.value.nationality = nationality
  showNationalityDropdown.value = false
  if(nationality.toLowerCase() === 'british') {
    formData.value.is_british_citizen = true
  } else {
    formData.value.is_british_citizen = false
  }
}

// Hide dropdown with delay to allow click
const hideNationalityDropdown = () => {
  setTimeout(() => {
    showNationalityDropdown.value = false
    submitError.value = ''
  }, 200)
}

// Select country from dropdown
const selectCountry = (country: { code: string, name: string }) => {
  countrySearch.value = country.name
  formData.value.current_country = country.code
  showCountryDropdown.value = false
}

// Hide country dropdown with delay to allow click
const hideCountryDropdown = () => {
  setTimeout(() => {
    showCountryDropdown.value = false
  }, 200)
}

// Select company country from dropdown
const selectCompanyCountry = (country: { code: string, name: string }) => {
  companyCountrySearch.value = country.name
  formData.value.employment_company_country = country.code
  showCompanyCountryDropdown.value = false
}

// Hide company country dropdown with delay to allow click
const hideCompanyCountryDropdown = () => {
  setTimeout(() => {
    showCompanyCountryDropdown.value = false
  }, 200)
}

// Select previous rental country from dropdown
const selectPreviousRentalCountry = (country: { code: string, name: string }) => {
  previousRentalCountrySearch.value = country.name
  formData.value.previous_rental_country = country.code
  showPreviousRentalCountryDropdown.value = false
}

// Hide previous rental country dropdown with delay to allow click
const hidePreviousRentalCountryDropdown = () => {
  setTimeout(() => {
    showPreviousRentalCountryDropdown.value = false
  }, 200)
}

// Dynamic postcode label based on country
const postcodeLabel = computed(() => {
  const countryCode = formData.value.current_country
  return POSTCODE_LABELS[countryCode] || 'Postcode'
})

// Dynamic postcode placeholder based on country
const postcodePlaceholder = computed(() => {
  const countryCode = formData.value.current_country
  return POSTCODE_PLACEHOLDERS[countryCode] || 'Enter postal code'
})

// Dynamic city placeholder based on country
const cityPlaceholder = computed(() => {
  const countryCode = formData.value.current_country
  return CAPITAL_CITIES[countryCode] || 'City'
})

// Consent validation - checks if all required consent fields are filled
const consentGiven = computed(() => {
  return !!(
    formData.value.consent_signature &&
    formData.value.consent_agreed_date &&
    formData.value.consent_printed_name
  )
})

// Previous address country dropdowns
const filteredPreviousAddressCountries = (index: number) => {
  const search = previousAddressCountrySearches.value[index] || ''
  if (!search) {
    // Show United Kingdom first, then all other countries
    const ukIndex = COUNTRIES.findIndex(c => c.code === 'GB')
    if (ukIndex !== -1) {
      return [COUNTRIES[ukIndex], ...COUNTRIES.filter(c => c.code !== 'GB')]
    }
    return COUNTRIES
  }
  const filtered = COUNTRIES.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
  // If UK matches the search, show it first
  const ukIndex = filtered.findIndex(c => c.code === 'GB')
  if (ukIndex !== -1) {
    return [filtered[ukIndex], ...filtered.filter(c => c.code !== 'GB')]
  }
  return filtered
}

const selectPreviousAddressCountry = (index: number, country: { code: string, name: string }) => {
  previousAddressCountrySearches.value[index] = country.name
  if (previousAddresses.value[index]) {
    previousAddresses.value[index].country = country.code
  }
  showPreviousAddressCountryDropdowns.value[index] = false
}

const hidePreviousAddressCountryDropdown = (index: number) => {
  setTimeout(() => {
    showPreviousAddressCountryDropdowns.value[index] = false
  }, 200)
}

const getPreviousAddressPostcodeLabel = (index: number) => {
  const countryCode = previousAddresses.value[index]?.country
  return (countryCode && POSTCODE_LABELS[countryCode]) || 'Postcode'
}

const getPreviousAddressPostcodePlaceholder = (index: number) => {
  const countryCode = previousAddresses.value[index]?.country
  return (countryCode && POSTCODE_PLACEHOLDERS[countryCode]) || 'Enter postal code'
}

const getPreviousAddressCityPlaceholder = (index: number) => {
  const countryCode = previousAddresses.value[index]?.country
  return (countryCode && CAPITAL_CITIES[countryCode]) || 'City'
}

// Computed properties for address history tracking
const totalAddressHistoryInMonths = computed(() => {
  // Start with current address
  let totalMonths = ((formData.value.time_at_address_years || 0) * 12) + (formData.value.time_at_address_months || 0)

  // Add previous addresses
  previousAddresses.value.forEach(addr => {
    totalMonths += ((addr.time_at_address_years || 0) * 12) + (addr.time_at_address_months || 0)
  })

  return totalMonths
})

const totalAddressHistoryYears = computed(() => {
  return Math.floor(totalAddressHistoryInMonths.value / 12)
})

const totalAddressHistoryMonths = computed(() => {
  return totalAddressHistoryInMonths.value % 12
})

const needsMoreAddressHistory = computed(() => {
  // Check if we have at least some time at current address
  const hasCurrentAddress = (formData.value.time_at_address_years !== null && formData.value.time_at_address_years !== undefined) ||
                           (formData.value.time_at_address_months !== null && formData.value.time_at_address_months !== undefined)

  if (!hasCurrentAddress) return false

  // Need 3 years (36 months) of address history
  return totalAddressHistoryInMonths.value < 36
})

// Benefits annual calculation
const benefitsAnnualAmount = computed(() => {
  const monthly = formData.value.benefits_monthly_amount || 0
  return monthly * 12
})

// Last completed tax year calculation (e.g., "2024/25")
const currentTaxYear = computed(() => {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1 // 0-indexed

  // UK tax year runs from April 6 to April 5
  // We need the LAST COMPLETED tax year, not the current one
  if (currentMonth >= 4) {
    // After April, we're in the new tax year, so last completed is previous year
    return `${currentYear - 1}/${String(currentYear).slice(-2)}`
  } else {
    // Before April, we're still in last year's tax year, so completed one is 2 years back
    return `${currentYear - 2}/${String(currentYear - 1).slice(-2)}`
  }
})

// File uploads
const idDocument = ref<File | null>(null)
const selfie = ref<File | null>(null)
const selfiePreview = ref<string | null>(null)
const proofOfAddress = ref<File | null>(null)

// Camera capture for selfie
const showCameraStream = ref(false)
const videoElement = ref<HTMLVideoElement | null>(null)
const canvasElement = ref<HTMLCanvasElement | null>(null)
const cameraStream = ref<MediaStream | null>(null)
const cameraError = ref<string>('')
const payslips = ref<File[]>([])
const proofOfFunds = ref<File | null>(null)
const proofOfAdditionalIncome = ref<File | null>(null)
const taxReturn = ref<File | null>(null)
const rtrAlternativeDocument = ref<File | null>(null)
const rtrBritishPassport = ref<File | null>(null)
const rtrBritishAltDoc = ref<File | null>(null)
const pensionStatement = ref<File | null>(null)
const landlordRentalBankStatement = ref<File | null>(null)

// Previous addresses for 3-year history
interface PreviousAddress {
  address_line1: string
  address_line2: string
  city: string
  postcode: string
  country: string
  time_at_address_years: number
  time_at_address_months: number
}

const previousAddresses = ref<PreviousAddress[]>([])
const previousAddressCountrySearches = ref<string[]>([])
const showPreviousAddressCountryDropdowns = ref<boolean[]>([])

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

  // Page 1: Right to Rent
  is_british_citizen: false as boolean | null,
  rtr_share_code: '',
  rtr_verified: false,
  rtr_verification_data: null as any,
  rtr_alternative_document_type: '',
  rtr_alternative_document_path: '',
  // British citizen RTR documents
  rtr_british_passport_path: '',
  rtr_british_no_passport: false,
  rtr_british_alt_doc_type: '' as '' | 'driving_license' | 'birth_certificate',
  rtr_british_alt_doc_path: '',

  // Page 4: Current Address
  current_address_line1: '',
  current_address_line2: '',
  current_city: '',
  current_postcode: '',
  current_country: '',
  time_at_address_years: null,
  time_at_address_months: null,

  // Page 3: Selfie
  selfie_path: '', // Uploaded file path

  // Page 5: Proof of Address
  proof_of_address_path: '', // Uploaded file path

  // Page 6: Financial - Income Sources
  income_regular_employment: false,
  income_self_employed: false,
  income_benefits: false,
  income_savings_pension_investments: false,
  income_pension: false,
  income_landlord_rental: false,
  income_student: false,
  income_unemployed: false,

  // Pension Income Details
  pension_monthly_amount: null as number | null,
  pension_provider: '',
  pension_statement_path: '',

  // Landlord/Rental Income Details
  landlord_rental_monthly_amount: null as number | null,
  landlord_rental_bank_statement_path: '',

  // Guarantor Details (for students/unemployed)
  requires_guarantor: false,
  guarantor_first_name: '',
  guarantor_last_name: '',
  guarantor_email: '',
  guarantor_phone: '',
  guarantor_relationship: '',

  // Benefits Details
  benefits_monthly_amount: null as number | null,
  benefits_annual_amount: null as number | null,

  // Savings, Pensions or Investments Details
  savings_amount: null,
  proof_of_funds_path: '',

  // Employment Details
  employment_contract_type: '',
  employment_start_date: '',
  employment_end_date: '',
  employment_is_hourly: false,
  employment_hours_per_month: null,
  employment_salary_amount: null,
  employment_salary_frequency: '',
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

  // Self-Employed Details
  self_employed_business_name: '',
  self_employed_start_date: '',
  self_employed_nature_of_business: '',
  self_employed_annual_income: null,

  // Accountant Details
  accountant_name: '',
  accountant_contact_name: '',
  accountant_email: '',
  accountant_phone: '',
  tax_return_path: '', // Tax return document path

  // Page 7: Additional Income or Savings
  has_additional_income: false,
  additional_income_type: '', // 'income' or 'savings'
  additional_income_source: '',
  additional_income_amount: null,
  additional_income_frequency: '',
  proof_of_additional_income_path: '',

  // Page 8: Adverse Credit
  has_adverse_credit: false,
  adverse_credit_details: '',

  // Page 9: Tenant Details
  is_smoker: null,
  has_pets: false,
  pet_details: '',
  marital_status: '',
  number_of_dependants: 0,
  dependants_details: '',

  // Page 10: Previous Landlord/Agent Reference
  reference_type: 'landlord', // 'landlord' or 'agent'
  previous_landlord_name: '',
  previous_landlord_email: '',
  previous_landlord_phone: '',
  previous_rental_address_line1: '',
  previous_rental_address_line2: '',
  previous_rental_city: '',
  previous_rental_postcode: '',
  previous_rental_country: '',
  tenancy_years: 0,
  tenancy_months: 0,
  previous_monthly_rent: null,
  previous_tenancy_start_date: '',
  previous_tenancy_end_date: '',
  previous_tenancy_still_in_progress: false,
  previous_agency_name: '',

  // Page 11: Referencing Consent
  consent_signature: '',
  consent_printed_name: '',
  consent_agreed_date: new Date().toISOString().split('T')[0] // YYYY-MM-DD format
})

const handleLegacyToken = async (token: string) => {
  if (isUuid(token)) {
    return false
  }

  try {
    await fetch(`${API_URL}/api/references/legacy-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'tenant', token })
    })
  } catch (error) {
    console.error('Legacy tenant link resend failed:', error)
  }

  tokenError.value = LEGACY_LINK_MESSAGE
  initialLoading.value = false
  return true
}

onMounted(async () => {
  if (typeof window !== 'undefined') {
    deviceLink.value = window.location.href
    const hasAcknowledged = localStorage.getItem(getDeviceGateStorageKey())
    showDeviceGate.value = hasAcknowledged !== 'true'
  }

  const token = route.params.token as string
  if (token && await handleLegacyToken(token)) {
    return
  }

  fetchReferenceByToken()
  checkExistingGuarantor()
})

const checkExistingGuarantor = async () => {
  try {
    const token = route.params.token
    const response = await fetch(`${API_URL}/api/references/check-guarantor/${token}`)

    // Handle 410 (expired link) response - silently skip checking guarantor
    if (response.status === 410) {
      return
    }

    if (response.ok) {
      const data = await response.json()
      if (data.hasGuarantor) {
        hasExistingGuarantor.value = true
        existingGuarantor.value = data.guarantor
        console.log('Existing guarantor found:', data.guarantor)
      }
    }
  } catch (error) {
    console.error('Failed to check for existing guarantor:', error)
    // Don't show error to user, just proceed
  }
}

const fetchReferenceByToken = async () => {
  try {
    const token = route.params.token
    const response = await fetch(`${API_URL}/api/references/view/${token}`, {
      headers: {
        'Content-Type': 'application/json'
      }
    })

    // Handle 410 (expired link) response
    if (response.status === 410) {
      await handleLegacyToken(token as string)
      return
    }

    if (!response.ok) {
      if (response.status === 404) {
        tokenError.value = 'Reference not found. Please check your link or contact the agent.'
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
      primaryColor.value = reference.value.companies.primary_color || defaultBranding.primaryColor
      buttonColor.value = reference.value.companies.button_color || defaultBranding.buttonColor
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
    previousAddresses: previousAddresses.value,
    previousAddressCountrySearches: previousAddressCountrySearches.value
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
      if (data.previousAddresses) {
        previousAddresses.value = data.previousAddresses
        // Initialize dropdown visibility for loaded addresses
        showPreviousAddressCountryDropdowns.value = new Array(data.previousAddresses.length).fill(false)
      }
      if (data.previousAddressCountrySearches) previousAddressCountrySearches.value = data.previousAddressCountrySearches
    } catch (error) {
      console.error('Failed to load from localStorage:', error)
    }
  }
}

const clearLocalStorage = () => {
  localStorage.removeItem(getStorageKey())
}

// Watch for changes and save to localStorage
watch([formData, currentPage, dobDay, dobMonth, dobYear, employmentStartDay, employmentStartMonth, employmentStartYear, nationalitySearch, countrySearch, companyCountrySearch, previousAddresses, previousAddressCountrySearches], () => {
  saveToLocalStorage()
}, { deep: true })

// Watch email fields to clear errors when they change
watch(() => formData.value.employer_ref_email, () => {
  employerEmailError.value = ''
})

watch(() => formData.value.accountant_email, () => {
  accountantEmailError.value = ''
})

watch(() => formData.value.previous_landlord_email, () => {
  landlordEmailError.value = ''
})

// Auto-calculate annual benefits when monthly amount changes
watch(() => formData.value.benefits_monthly_amount, (newValue) => {
  if (newValue !== null && newValue !== undefined) {
    formData.value.benefits_annual_amount = Number(newValue) * 12
  } else {
    formData.value.benefits_annual_amount = null
  }
})

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

// Camera capture functions for selfie
const startCamera = async () => {
  cameraError.value = ''
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user' }, // Front-facing camera
      audio: false
    })
    cameraStream.value = stream
    showCameraStream.value = true

    // Wait for next tick to ensure video element is rendered
    await new Promise(resolve => setTimeout(resolve, 100))

    if (videoElement.value) {
      videoElement.value.srcObject = stream
    }
  } catch (error) {
    console.error('Camera access error:', error)
    if (error instanceof Error) {
      if (error.name === 'NotAllowedError') {
        cameraError.value = 'Camera access denied. Please allow camera access to take a selfie.'
      } else if (error.name === 'NotFoundError') {
        cameraError.value = 'No camera found on this device.'
      } else {
        cameraError.value = 'Unable to access camera. Please try again.'
      }
    }
  }
}

const stopCamera = () => {
  if (cameraStream.value) {
    cameraStream.value.getTracks().forEach(track => track.stop())
    cameraStream.value = null
  }
  showCameraStream.value = false
  if (videoElement.value) {
    videoElement.value.srcObject = null
  }
}

const capturePhoto = () => {
  if (!videoElement.value || !canvasElement.value) return

  const video = videoElement.value
  const canvas = canvasElement.value

  // Set canvas dimensions to match video
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight

  // Draw the video frame to canvas (flip horizontally to match preview)
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
  }

  // Convert canvas to blob then to file
  canvas.toBlob((blob) => {
    if (blob) {
      const timestamp = new Date().getTime()
      const file = new File([blob], `selfie-${timestamp}.jpg`, { type: 'image/jpeg' })
      selfie.value = file
      selfiePreview.value = canvas.toDataURL('image/jpeg')

      // Stop camera and hide stream
      stopCamera()
      submitError.value = ''
    }
  }, 'image/jpeg', 0.9)
}

const removeSelfie = () => {
  selfie.value = null
  selfiePreview.value = null
  formData.value.selfie_path = ''
  stopCamera()
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

const handleProofOfFundsUpload = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files[0]) {
    const file = target.files[0]
    if (file.size > 10 * 1024 * 1024) {
      submitError.value = 'File is too large. Max size is 10MB.'
      return
    }
    proofOfFunds.value = file
    submitError.value = ''
  }
}

const removeProofOfFunds = () => {
  proofOfFunds.value = null
}

const handlePensionStatementUpload = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files[0]) {
    const file = target.files[0]
    if (file.size > 10 * 1024 * 1024) {
      submitError.value = 'File is too large. Max size is 10MB.'
      return
    }
    pensionStatement.value = file
    submitError.value = ''
  }
}

const removePensionStatement = () => {
  pensionStatement.value = null
}

const handleLandlordRentalBankStatementUpload = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files[0]) {
    const file = target.files[0]
    if (file.size > 10 * 1024 * 1024) {
      submitError.value = 'File is too large. Max size is 10MB.'
      return
    }
    landlordRentalBankStatement.value = file
    submitError.value = ''
  }
}

const removeLandlordRentalBankStatement = () => {
  landlordRentalBankStatement.value = null
}

const handleTaxReturnUpload = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files[0]) {
    const file = target.files[0]
    if (file.size > 10 * 1024 * 1024) {
      submitError.value = 'File is too large. Max size is 10MB.'
      return
    }
    taxReturn.value = file
    submitError.value = ''
  }
}

const removeTaxReturn = () => {
  taxReturn.value = null
}

const handleProofOfAdditionalIncomeUpload = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files[0]) {
    const file = target.files[0]
    if (file.size > 10 * 1024 * 1024) {
      submitError.value = 'File is too large. Max size is 10MB.'
      return
    }
    proofOfAdditionalIncome.value = file
    submitError.value = ''
  }
}

const removeProofOfAdditionalIncome = () => {
  proofOfAdditionalIncome.value = null
}

const handleAlternativeDocumentUpload = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files[0]) {
    const file = target.files[0]
    if (file.size > 10 * 1024 * 1024) {
      submitError.value = 'File is too large. Max size is 10MB.'
      return
    }
    rtrAlternativeDocument.value = file
    formData.value.rtr_alternative_document_path = ''
    submitError.value = ''
  }
}

const removeAlternativeDocument = () => {
  rtrAlternativeDocument.value = null
  formData.value.rtr_alternative_document_path = ''
}

// British citizen passport upload handlers
const handleBritishPassportUpload = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files[0]) {
    const file = target.files[0]
    if (file.size > 10 * 1024 * 1024) {
      submitError.value = 'File is too large. Max size is 10MB.'
      return
    }
    rtrBritishPassport.value = file
    formData.value.rtr_british_passport_path = ''
    submitError.value = ''
  }
}

const removeBritishPassport = () => {
  rtrBritishPassport.value = null
  formData.value.rtr_british_passport_path = ''
}

// British citizen alternative document upload handlers
const handleBritishAltDocUpload = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files[0]) {
    const file = target.files[0]
    if (file.size > 10 * 1024 * 1024) {
      submitError.value = 'File is too large. Max size is 10MB.'
      return
    }
    rtrBritishAltDoc.value = file
    formData.value.rtr_british_alt_doc_path = ''
    submitError.value = ''
  }
}

const removeBritishAltDoc = () => {
  rtrBritishAltDoc.value = null
  formData.value.rtr_british_alt_doc_path = ''
}

// Handle no passport checkbox change
const handleNoPassportChange = () => {
  if (formData.value.rtr_british_no_passport) {
    // User checked "no passport" - clear passport data
    rtrBritishPassport.value = null
    formData.value.rtr_british_passport_path = ''
  } else {
    // User unchecked "no passport" - clear alt doc data
    rtrBritishAltDoc.value = null
    formData.value.rtr_british_alt_doc_type = ''
    formData.value.rtr_british_alt_doc_path = ''
  }
}

// Previous address management
const addPreviousAddress = () => {
  previousAddresses.value.push({
    address_line1: '',
    address_line2: '',
    city: '',
    postcode: '',
    country: '',
    time_at_address_years: 0,
    time_at_address_months: 0
  })
  previousAddressCountrySearches.value.push('')
  showPreviousAddressCountryDropdowns.value.push(false)
}

const removePreviousAddress = (index: number) => {
  previousAddresses.value.splice(index, 1)
  previousAddressCountrySearches.value.splice(index, 1)
  showPreviousAddressCountryDropdowns.value.splice(index, 1)
}

const updateAddressHistory = () => {
  // This function is called when time at address changes
  // The computed properties will automatically recalculate
}

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

const formatDate = (date: string) =>
  formatUkDate(
    date,
    {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    },
    'Not specified'
  )

const agentCompanyName = computed(() => reference.value?.company_name || reference.value?.companies?.name || 'PropertyGoose')
const agentCompanyEmail = computed(() => reference.value?.company_email || reference.value?.companies?.email || '')
const agentCompanyPhone = computed(() => reference.value?.company_phone || reference.value?.companies?.phone || '')
const agentCompanyAddress = computed(() => {
  const parts = [
    reference.value?.company_address || reference.value?.companies?.address || '',
    reference.value?.company_city || reference.value?.companies?.city || '',
    reference.value?.company_postcode || reference.value?.companies?.postcode || ''
  ].filter(Boolean)
  return parts.join(', ')
})
const agentCompanyWebsite = computed(() => reference.value?.company_website || reference.value?.companies?.website || '')

const tenantRequestDetails = computed(() => {
  if (!reference.value) return []
  const details: { label: string; value: string }[] = []
  const applicant = [reference.value.tenant_first_name, reference.value.tenant_last_name].filter(Boolean).join(' ').trim()
  if (applicant) {
    details.push({ label: 'Applicant', value: applicant })
  }
  if (reference.value.property_address) {
    details.push({ label: 'Property', value: reference.value.property_address })
  }
  if (reference.value.move_in_date) {
    details.push({ label: 'Proposed Move-in', value: formatUkDate(reference.value.move_in_date) })
  }
  if (reference.value.monthly_rent) {
    const rent = Number(reference.value.monthly_rent)
    if (!Number.isNaN(rent) && rent > 0) {
      details.push({
        label: 'Monthly Rent',
        value: `£${rent.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
      })
    }
  }
  return details
})

const deviceGateTitle = computed(() => `Confirm the request from ${agentCompanyName.value}`)
const deviceGateDescription = computed(
  () =>
    `To complete your tenant reference, ${agentCompanyName.value} needs to capture your ID and a live selfie. Switch to your phone with the QR code, or continue here if this device has a working camera.`
)

const showProgressBar = computed(
  () => !initialLoading.value && !tokenError.value && reference.value && !reference.value.submitted_at && !showDeviceGate.value
)

const handleDeviceGateProceed = () => {
  showDeviceGate.value = false
  if (typeof window !== 'undefined') {
    localStorage.setItem(getDeviceGateStorageKey(), 'true')
  }
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

  if (currentPage.value === 2 && rtrAlternativeDocument.value && !formData.value.rtr_alternative_document_path) {
    formDataFiles.append('rtr_alternative_document', rtrAlternativeDocument.value)
    hasFilesToUpload = true
  }

  // British citizen passport upload (page 2)
  if (currentPage.value === 2 && rtrBritishPassport.value && !formData.value.rtr_british_passport_path) {
    formDataFiles.append('rtr_british_passport', rtrBritishPassport.value)
    hasFilesToUpload = true
  }

  // British citizen alternative document upload (page 2)
  if (currentPage.value === 2 && rtrBritishAltDoc.value && !formData.value.rtr_british_alt_doc_path) {
    formDataFiles.append('rtr_british_alt_doc', rtrBritishAltDoc.value)
    hasFilesToUpload = true
  }

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

  if (currentPage.value === 6 && proofOfFunds.value && !formData.value.proof_of_funds_path) {
    formDataFiles.append('proof_of_funds', proofOfFunds.value)
    hasFilesToUpload = true
  }

  if (currentPage.value === 6 && taxReturn.value && !formData.value.tax_return_path) {
    formDataFiles.append('tax_return', taxReturn.value)
    hasFilesToUpload = true
  }

  if (currentPage.value === 6 && pensionStatement.value && !formData.value.pension_statement_path) {
    formDataFiles.append('pension_statement', pensionStatement.value)
    hasFilesToUpload = true
  }

  if (currentPage.value === 6 && landlordRentalBankStatement.value && !formData.value.landlord_rental_bank_statement_path) {
    formDataFiles.append('landlord_rental_bank_statement', landlordRentalBankStatement.value)
    hasFilesToUpload = true
  }

  if (currentPage.value === 7 && proofOfAdditionalIncome.value && !formData.value.proof_of_additional_income_path) {
    formDataFiles.append('proof_of_additional_income', proofOfAdditionalIncome.value)
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
  if (uploadedFiles.proof_of_funds) {
    formData.value.proof_of_funds_path = uploadedFiles.proof_of_funds
  }
  if (uploadedFiles.tax_return) {
    formData.value.tax_return_path = uploadedFiles.tax_return
  }
  if (uploadedFiles.proof_of_additional_income) {
    formData.value.proof_of_additional_income_path = uploadedFiles.proof_of_additional_income
  }
  if (uploadedFiles.rtr_alternative_document) {
    formData.value.rtr_alternative_document_path = uploadedFiles.rtr_alternative_document
    rtrAlternativeDocument.value = null
  }
  if (uploadedFiles.rtr_british_passport) {
    formData.value.rtr_british_passport_path = uploadedFiles.rtr_british_passport
    rtrBritishPassport.value = null
  }
  if (uploadedFiles.rtr_british_alt_doc) {
    formData.value.rtr_british_alt_doc_path = uploadedFiles.rtr_british_alt_doc
    rtrBritishAltDoc.value = null
  }
  if (uploadedFiles.payslips && uploadedFiles.payslips.length > 0) {
    formData.value.payslip_paths = uploadedFiles.payslips
  }
  if (uploadedFiles.pension_statement) {
    formData.value.pension_statement_path = uploadedFiles.pension_statement
  }
  if (uploadedFiles.landlord_rental_bank_statement) {
    formData.value.landlord_rental_bank_statement_path = uploadedFiles.landlord_rental_bank_statement
  }
}

const handlePageSubmit = async () => {
  submitError.value = ''
  fieldErrors.value = {}

  const errors: Record<string, string> = {}

  // Basic per-page required-checks to drive inline field errors
  if (currentPage.value === 1) {
    if (!formData.value.id_document_type) {
      errors.id_document_type = 'Please select a document type'
    }
    if (!idDocument.value && !formData.value.id_document_path) {
      submitError.value = 'Please upload your ID document'
    }
  } else if (currentPage.value === 2) {
    if (!formData.value.first_name?.trim()) {
      errors.first_name = 'First name is required'
    }
    if (!formData.value.last_name?.trim()) {
      errors.last_name = 'Last name is required'
    }
    if (!dobDay.value || !dobMonth.value || !dobYear.value) {
      errors.dob = 'Please select your complete date of birth'
    }
    if (!formData.value.contact_number) {
      errors.contact_number = 'Please enter your contact number'
    }
    if (!nationalitySearch.value?.trim()) {
      errors.nationality = 'Please select your nationality'
    }
  }

  if (Object.keys(errors).length > 0) {
    fieldErrors.value = errors
    // If we already set a top-level submitError (e.g. missing upload), keep it to show both
    if (submitError.value) {
      return
    }
  }

  // Existing page-specific validation and RTR logic
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

    // RTR validation based on nationality
    if (formData.value.nationality) {
      const isBritish = formData.value.nationality.toLowerCase() === 'british'

      if (isBritish) {
        // British citizens: Set is_british_citizen to true
        formData.value.is_british_citizen = true

        // British citizens need passport OR (no passport + alternative doc)
        if (!formData.value.rtr_british_no_passport) {
          // Must have passport
          if (!rtrBritishPassport.value && !formData.value.rtr_british_passport_path) {
            submitError.value = 'Please upload your passport for Right to Rent verification'
            return
          }
        } else {
          // No passport - must have alternative document
          if (!formData.value.rtr_british_alt_doc_type) {
            submitError.value = 'Please select which document you are uploading (Driving Licence or Birth Certificate)'
            return
          }
          if (!rtrBritishAltDoc.value && !formData.value.rtr_british_alt_doc_path) {
            submitError.value = `Please upload your ${formData.value.rtr_british_alt_doc_type === 'driving_license' ? 'Driving Licence' : 'Birth Certificate'}`
            return
          }
        }
      } else {
        // International tenants: Set is_british_citizen to false
        formData.value.is_british_citizen = false

        // Share code is required
        if (!formData.value.rtr_share_code) {
          submitError.value = 'Please enter your Right to Rent share code'
          return
        }
        // Evidence upload is optional - no validation needed
      }
    }
  } else if (currentPage.value === 3) {
    if (!selfie.value && !formData.value.selfie_path) {
      submitError.value = 'Please upload a selfie'
      return
    }
  } else if (currentPage.value === 4) {
    // Validate address history - need 3 years total
    if (totalAddressHistoryInMonths.value < 36) {
      // Validate all previous addresses have required fields
      for (let i = 0; i < previousAddresses.value.length; i++) {
        const addr = previousAddresses.value[i]
        if (!addr) {
          submitError.value = `Previous Address ${i + 1} is missing`
          return
        }
        if (!addr.address_line1 || !addr.city || !addr.postcode || !addr.country) {
          submitError.value = `Please complete all required fields for Previous Address ${i + 1}`
          return
        }
        if (addr.time_at_address_years === null || addr.time_at_address_years === undefined) {
          submitError.value = `Please enter the time at Previous Address ${i + 1}`
          return
        }
      }

      submitError.value = 'Please provide enough address history to cover 3 years. Add more previous addresses if needed.'
      return
    }
  } else if (currentPage.value === 5) {
    if (!proofOfAddress.value && !formData.value.proof_of_address_path) {
      submitError.value = 'Please upload proof of address'
      return
    }
  } else if (currentPage.value === 6) {
    // Validate employer email if regular employment income is selected
    if (formData.value.income_regular_employment && formData.value.employer_ref_email) {
      if (!isWorkEmail(formData.value.employer_ref_email)) {
        employerEmailError.value = 'Please use a work email address (not Gmail, Hotmail, Yahoo, etc.)'
        submitError.value = 'Please use a work email address for your employer'
        return
      }
    }

    // Validate accountant email if self-employed income is selected
    if (formData.value.income_self_employed && formData.value.accountant_email) {
      if (!isWorkEmail(formData.value.accountant_email)) {
        accountantEmailError.value = 'Please use a professional accountant email address (not Gmail, Hotmail, Yahoo, etc.)'
        submitError.value = 'Please use a professional email address for your accountant'
        return
      }
    }

    // Validate proof of funds if savings/investments is selected
    if (formData.value.income_savings_pension_investments) {
      if (!proofOfFunds.value && !formData.value.proof_of_funds_path) {
        submitError.value = 'Please upload proof of funds (bank statement or investment portfolio)'
        return
      }
    }

    // Validate pension statement if pension income is selected
    if (formData.value.income_pension) {
      if (!pensionStatement.value && !formData.value.pension_statement_path) {
        submitError.value = 'Please upload your pension statement'
        return
      }
      if (!formData.value.pension_monthly_amount) {
        submitError.value = 'Please enter your monthly pension amount'
        return
      }
      if (!formData.value.pension_provider) {
        submitError.value = 'Please enter your pension provider'
        return
      }
    }

    // Validate landlord/rental income bank statement if selected
    if (formData.value.income_landlord_rental) {
      if (!landlordRentalBankStatement.value && !formData.value.landlord_rental_bank_statement_path) {
        submitError.value = 'Please upload bank statement showing rental income'
        return
      }
      if (!formData.value.landlord_rental_monthly_amount) {
        submitError.value = 'Please enter your monthly rental income'
        return
      }
    }
  } else if (currentPage.value === 7) {
    // Validate proof of additional income/savings if declared
    if (formData.value.has_additional_income) {
      if (!proofOfAdditionalIncome.value && !formData.value.proof_of_additional_income_path) {
        submitError.value = 'Please upload proof of additional income or savings'
        return
      }
    }
  } else if (currentPage.value === 10) {
    // Validate agent email only (landlords can use personal email)
    if (formData.value.reference_type === 'agent' && formData.value.previous_landlord_email && !isWorkEmail(formData.value.previous_landlord_email)) {
      landlordEmailError.value = 'Please use the letting agency email address (not a personal Gmail, Hotmail, etc.)'
      submitError.value = 'Please use the letting agency email address'
      return
    }
  }

  // If on last page, submit the form
  if (currentPage.value === 11) {
    await handleFinalSubmit()
  } else {
    // Upload files for current page before moving to next page
    try {
      submitting.value = true
      uploadProgress.value = 10

      await uploadCurrentPageFiles()

      uploadProgress.value = 0
      submitting.value = false
      submitError.value = ''

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
      payslip_files: formData.value.payslip_paths,
      // Include previous addresses for 3-year history
      previous_addresses: previousAddresses.value,
      rtr_alternative_document_type: formData.value.rtr_alternative_document_type || null,
      rtr_alternative_document_path: formData.value.rtr_alternative_document_path || null,
      // British citizen RTR documents
      rtr_british_passport_path: formData.value.rtr_british_passport_path || null,
      rtr_british_no_passport: formData.value.rtr_british_no_passport || false,
      rtr_british_alt_doc_type: formData.value.rtr_british_alt_doc_type || null,
      rtr_british_alt_doc_path: formData.value.rtr_british_alt_doc_path || null,
      geolocation: userGeolocation.value,
      final_submit: true
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

// Address autocomplete handlers
const handleCurrentAddressSelected = (addressData: any) => {
  formData.value.current_address_line1 = addressData.addressLine1
  formData.value.current_city = addressData.city
  formData.value.current_postcode = addressData.postcode

  // Update country if available
  if (addressData.country.name) {
    countrySearch.value = addressData.country.name
    formData.value.current_country = addressData.country.code
  }
}

const handlePreviousAddressSelected = (index: number, addressData: any) => {
  if (previousAddresses.value[index]) {
    previousAddresses.value[index].address_line1 = addressData.addressLine1
    previousAddresses.value[index].city = addressData.city
    previousAddresses.value[index].postcode = addressData.postcode

    // Update country if available
    if (addressData.country.name) {
      previousAddressCountrySearches.value[index] = addressData.country.name
      previousAddresses.value[index].country = addressData.country.code
    }
  }
}

const handleCompanyAddressSelected = (addressData: any) => {
  formData.value.employment_company_address_line1 = addressData.addressLine1
  formData.value.employment_company_city = addressData.city
  formData.value.employment_company_postcode = addressData.postcode

  // Update company country if available
  if (addressData.country.name) {
    companyCountrySearch.value = addressData.country.name
    formData.value.employment_company_country = addressData.country.code
  }
}

const handlePreviousRentalAddressSelected = (addressData: any) => {
  formData.value.previous_rental_address_line1 = addressData.addressLine1
  formData.value.previous_rental_city = addressData.city
  formData.value.previous_rental_postcode = addressData.postcode

  // Update country if available
  if (addressData.country.name) {
    previousRentalCountrySearch.value = addressData.country.name
    formData.value.previous_rental_country = addressData.country.code
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
