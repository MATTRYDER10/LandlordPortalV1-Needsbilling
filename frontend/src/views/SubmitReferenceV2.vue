<template>
  <div class="min-h-screen bg-gray-50 dark:bg-slate-900 py-8 px-4 sm:px-6 lg:px-8">
    <div class="max-w-2xl mx-auto">
      <!-- Header (hide when showing device gate - it has its own header) -->
      <div v-if="!loading && !showDeviceGate" class="text-center mb-8">
        <div class="flex justify-center items-center gap-3 mb-4">
          <template v-if="companyLogo">
            <img :src="companyLogo" alt="Company Logo" class="h-16 object-contain" />
          </template>
          <template v-else>
            <img src="/PropertyGooseLogo.png" alt="PropertyGoose" class="h-12 dark:hidden" />
            <img src="/PropertyGooseLogoDark.png" alt="PropertyGoose" class="h-12 hidden dark:block" />
          </template>
        </div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Tenant Reference Form</h1>
        <p class="mt-2 text-gray-600 dark:text-slate-400">Complete all sections to submit your reference</p>
      </div>

      <!-- Progress Bar (hide when showing device gate) -->
      <div v-if="!loading && !error && !submitted && !showDeviceGate" class="mb-6">
        <div class="flex justify-between items-center mb-2">
          <span class="text-sm font-medium text-gray-700 dark:text-slate-300">
            Section {{ currentStep }} of {{ totalSteps }}
          </span>
          <span class="text-sm text-gray-500 dark:text-slate-400">
            {{ Math.round((currentStep / totalSteps) * 100) }}%
          </span>
        </div>
        <div class="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
          <div
            class="h-2 rounded-full transition-all duration-300"
            :style="{ width: (currentStep / totalSteps * 100) + '%', backgroundColor: primaryColor }"
          ></div>
        </div>
        <div class="flex flex-wrap gap-2 mt-3">
          <span
            v-for="(step, index) in steps"
            :key="step.id"
            class="text-xs px-2 py-1 rounded-full"
            :class="index + 1 < currentStep
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : index + 1 === currentStep
                ? 'bg-primary/10 text-primary font-medium'
                : 'bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-400'"
          >
            {{ step.label }}
          </span>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="bg-white dark:bg-slate-800 rounded-xl shadow p-8 text-center">
        <Loader2 class="w-8 h-8 animate-spin mx-auto text-primary" />
        <p class="mt-4 text-gray-600 dark:text-slate-400">Loading your reference...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
        <AlertCircle class="w-12 h-12 mx-auto text-red-500" />
        <h3 class="mt-4 text-lg font-semibold text-red-700 dark:text-red-400">Unable to Load Reference</h3>
        <p class="mt-2 text-red-600 dark:text-red-300">{{ error }}</p>
      </div>

      <!-- Already Submitted -->
      <div v-else-if="submitted || reference?.form_submitted_at" class="bg-white dark:bg-slate-800 rounded-xl shadow p-8 text-center">
        <CheckCircle class="w-16 h-16 mx-auto text-green-500" />
        <h3 class="mt-4 text-xl font-semibold text-gray-900 dark:text-white">Thank You!</h3>
        <p class="mt-2 text-gray-600 dark:text-slate-400">
          Your reference has been submitted successfully. {{ companyName }} will be in touch with the next steps.
        </p>
      </div>

      <!-- Device Handoff Gate (QR code to switch to mobile) -->
      <DeviceHandoffGate
        v-else-if="reference && showDeviceGate"
        :title="deviceGateTitle"
        :description="deviceGateDescription"
        :company-name="companyName"
        :company-logo="companyLogo"
        :company-contact-email="companyEmail"
        :company-contact-phone="companyPhone"
        :company-contact-address="companyAddress"
        :company-website="companyWebsite"
        :request-details="tenantRequestDetails"
        :link="deviceLink"
        :primary-color="primaryColor"
        :button-color="buttonColor"
        proceed-label="Proceed on this device (Camera required)"
        @proceed="handleDeviceGateProceed"
      />

      <!-- Form -->
      <form v-else-if="reference && !showDeviceGate" @submit.prevent="handleSubmit" novalidate class="space-y-6">
        <!-- Reference Info Banner -->
        <div class="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
          <p class="text-sm text-blue-800 dark:text-blue-300">
            <strong>{{ companyName }}</strong> has requested this reference for your tenancy at
            <strong>{{ reference.property_address }}</strong>.
            <span v-if="reference.move_in_date"> Move-in date: <strong>{{ formatDate(reference.move_in_date) }}</strong></span>
            <span v-if="reference.monthly_rent"> | Rent: <strong>£{{ reference.monthly_rent }}/month</strong></span>
          </p>
        </div>

        <!-- ========== SECTION 1: IDENTITY ========== -->
        <div v-show="steps[currentStep - 1]?.id === 'identity'" class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
          <div class="px-6 py-4 bg-gray-50 dark:bg-slate-700/50 border-b border-gray-200 dark:border-slate-700">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <User class="w-5 h-5 text-primary" />
              Identity Verification
            </h2>
            <p class="text-sm text-gray-600 dark:text-slate-400 mt-1">Provide your identification details and upload your ID document</p>
          </div>

          <div class="p-6 space-y-5">
            <!-- Personal Details -->
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">First Name *</label>
                <input
                  v-model="formData.identity.firstName"
                  type="text"
                  required
                  class="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Last Name *</label>
                <input
                  v-model="formData.identity.lastName"
                  type="text"
                  required
                  class="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary"
                />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Date of Birth *</label>
                <input
                  v-model="formData.identity.dateOfBirth"
                  type="date"
                  required
                  class="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Phone Number *</label>
                <input
                  v-model="formData.identity.phone"
                  type="tel"
                  required
                  placeholder="+44 7XXX XXXXXX"
                  class="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary"
                />
              </div>
            </div>

            <!-- ID Document -->
            <div class="pt-4 border-t border-gray-200 dark:border-slate-700">
              <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">ID Document Type *</label>
              <select
                v-model="formData.identity.documentType"
                required
                class="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary"
              >
                <option value="">Select document type</option>
                <option value="passport">Passport</option>
                <option value="driving_licence">Driving Licence</option>
                <option value="biometric_residence_permit">Biometric Residence Permit (BRP)</option>
                <option value="national_id">National ID Card</option>
              </select>
            </div>

            <!-- ID Upload -->
            <FileUpload
              v-model="formData.identity.idDocument"
              label="Upload ID Document"
              required
              accept=".pdf,.jpg,.jpeg,.png"
              acceptLabel="PDF, JPG, PNG up to 25MB"
              helpText="Please upload a clear photo or scan of your ID document"
              :uploadUrl="`${API_URL}/api/v2/tenant-form/${token}/upload`"
              :token="token"
              section="identity"
              @uploaded="handleFileUploaded('identity', 'idDocument', $event)"
            />

            <!-- Selfie/Photo with Camera Capture -->
            <div class="pt-6 border-t border-gray-200 dark:border-slate-700">
              <!-- Section Header -->
              <div class="mb-4">
                <h3 class="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Camera class="w-5 h-5 text-primary" />
                  Identity Photo Verification
                  <span class="text-red-500">*</span>
                </h3>
                <p class="mt-1 text-sm text-gray-600 dark:text-slate-400">
                  We need a clear selfie to match your face to your ID document. This helps protect against identity fraud.
                </p>
              </div>

              <!-- Photo Tips Box -->
              <div v-if="!selfiePreview && !showCameraStream" class="mb-5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                <h4 class="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-3 flex items-center gap-2">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Tips for the Perfect Photo
                </h4>
                <ul class="space-y-2 text-sm text-blue-700 dark:text-blue-300">
                  <li class="flex items-start gap-2">
                    <svg class="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                    </svg>
                    <span><strong>Good lighting</strong> — Face a window or light source. Avoid backlighting.</span>
                  </li>
                  <li class="flex items-start gap-2">
                    <svg class="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                    </svg>
                    <span><strong>Plain background</strong> — Stand against a white or light-coloured wall.</span>
                  </li>
                  <li class="flex items-start gap-2">
                    <svg class="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                    </svg>
                    <span><strong>Face clearly visible</strong> — Remove glasses, hats, or anything covering your face.</span>
                  </li>
                  <li class="flex items-start gap-2">
                    <svg class="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                    </svg>
                    <span><strong>Look directly at camera</strong> — Keep a neutral expression, eyes open.</span>
                  </li>
                  <li class="flex items-start gap-2">
                    <svg class="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                    </svg>
                    <span><strong>Match your ID</strong> — Your face will be compared to your ID photo.</span>
                  </li>
                </ul>
              </div>

              <!-- Camera stream view with face outline -->
              <div v-if="showCameraStream" class="space-y-4">
                <div class="relative bg-black rounded-xl overflow-hidden shadow-lg" style="max-width: 480px;">
                  <video
                    ref="videoElement"
                    autoplay
                    playsinline
                    class="w-full h-auto"
                    style="transform: scaleX(-1);"
                  ></video>
                  <canvas ref="canvasElement" class="hidden"></canvas>

                  <!-- Face outline overlay -->
                  <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div class="relative">
                      <!-- Oval face outline with guide -->
                      <div
                        class="w-52 h-72 border-4 border-white/80 rounded-full"
                        style="box-shadow: 0 0 0 9999px rgba(0,0,0,0.5);"
                      ></div>
                      <!-- Corner guides -->
                      <div class="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-white/80 rounded-full"></div>
                      <div class="absolute -bottom-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-white/80 rounded-full"></div>
                    </div>
                  </div>

                  <!-- Instructions overlay -->
                  <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent p-5">
                    <p class="text-white text-sm text-center font-medium">
                      Position your face within the oval
                    </p>
                    <p class="text-white/80 text-xs text-center mt-1">
                      Ensure all facial features are clearly visible
                    </p>
                  </div>
                </div>

                <div class="flex gap-3">
                  <button
                    type="button"
                    @click="capturePhoto"
                    class="px-6 py-2.5 text-sm font-semibold text-white rounded-lg flex items-center gap-2 shadow-sm"
                    :style="{ backgroundColor: buttonColor }"
                  >
                    <Camera class="w-4 h-4" />
                    Capture Photo
                  </button>
                  <button
                    type="button"
                    @click="stopCamera"
                    class="px-4 py-2.5 text-sm font-semibold bg-gray-100 dark:bg-slate-700 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>

              <!-- Preview or capture button -->
              <div v-else>
                <!-- Selfie captured -->
                <div v-if="selfiePreview" class="space-y-4">
                  <div class="flex items-start gap-4">
                    <div class="relative">
                      <img
                        :src="selfiePreview"
                        alt="Selfie preview"
                        class="w-32 h-40 object-cover rounded-xl border-2 border-gray-200 dark:border-slate-600 shadow-sm"
                      />
                      <div v-if="selfieUploading" class="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center">
                        <Loader2 class="w-8 h-8 text-white animate-spin" />
                      </div>
                      <div v-else-if="selfieUploaded" class="absolute -top-2 -right-2 bg-green-500 rounded-full p-1.5 shadow-sm">
                        <CheckCircle class="w-4 h-4 text-white" />
                      </div>
                    </div>
                    <div class="flex-1">
                      <div v-if="selfieUploaded" class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                        <p class="text-sm font-medium text-green-700 dark:text-green-400 flex items-center gap-2">
                          <CheckCircle class="w-4 h-4" />
                          Photo uploaded successfully
                        </p>
                        <p class="text-xs text-green-600 dark:text-green-500 mt-1">
                          Your photo will be securely compared to your ID document.
                        </p>
                      </div>
                      <div v-else-if="selfieUploading" class="text-sm text-gray-500">
                        <Loader2 class="w-4 h-4 animate-spin inline mr-2" />
                        Uploading securely...
                      </div>
                      <button
                        type="button"
                        @click="removeSelfie"
                        class="mt-3 text-sm text-red-600 hover:text-red-800 font-medium"
                      >
                        Remove and retake
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Start camera button -->
                <div v-else class="space-y-4">
                  <button
                    type="button"
                    @click="startCamera"
                    class="w-full sm:w-auto px-6 py-3 text-sm font-semibold text-white rounded-xl flex items-center justify-center gap-2 shadow-sm hover:opacity-90 transition-opacity"
                    :style="{ backgroundColor: buttonColor }"
                  >
                    <Camera class="w-5 h-5" />
                    Open Camera & Take Photo
                  </button>
                </div>
              </div>

              <!-- Security Notice -->
              <div class="mt-5 flex items-start gap-3 p-3 bg-gray-50 dark:bg-slate-800/50 rounded-lg border border-gray-200 dark:border-slate-700">
                <svg class="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <div class="text-xs text-gray-500 dark:text-slate-400">
                  <strong class="text-gray-700 dark:text-slate-300">Your data is protected.</strong>
                  Your photo is encrypted during transfer and storage. It is only used for identity verification and is automatically deleted after processing in accordance with GDPR.
                </div>
              </div>

              <p v-if="cameraError" class="mt-3 text-sm text-red-600 flex items-center gap-2">
                <AlertCircle class="w-4 h-4" />
                {{ cameraError }}
              </p>
            </div>
          </div>
        </div>

        <!-- ========== SECTION 2: RIGHT TO RENT ========== -->
        <div v-show="steps[currentStep - 1]?.id === 'rtr'" class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
          <div class="px-6 py-4 bg-gray-50 dark:bg-slate-700/50 border-b border-gray-200 dark:border-slate-700">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Shield class="w-5 h-5 text-primary" />
              Right to Rent
            </h2>
            <p class="text-sm text-gray-600 dark:text-slate-400 mt-1">Confirm your right to rent in the UK</p>
          </div>

          <div class="p-6 space-y-5">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Citizenship Status *</label>
              <select
                v-model="formData.rtr.citizenshipStatus"
                required
                class="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary"
              >
                <option value="">Select status</option>
                <option value="uk_citizen">British/Irish Citizen</option>
                <option value="eu_settled">EU Settled Status</option>
                <option value="eu_pre_settled">EU Pre-Settled Status</option>
                <option value="visa">Visa Holder</option>
                <option value="other">Other</option>
              </select>
            </div>

            <!-- UK Citizen - Passport Upload -->
            <div v-if="formData.rtr.citizenshipStatus === 'uk_citizen'" class="space-y-4">
              <FileUpload
                v-model="formData.rtr.passportDoc"
                label="Upload Passport"
                accept=".pdf,.jpg,.jpeg,.png"
                acceptLabel="PDF, JPG, PNG up to 25MB"
                helpText="Upload a clear copy of your passport photo page"
                :uploadUrl="`${API_URL}/api/v2/tenant-form/${token}/upload`"
                :token="token"
                section="rtr"
                @uploaded="handleFileUploaded('rtr', 'passportDoc', $event)"
              />

              <div class="flex items-center gap-2">
                <input
                  v-model="formData.rtr.noPassport"
                  type="checkbox"
                  id="noPassport"
                  class="w-4 h-4 text-primary rounded"
                />
                <label for="noPassport" class="text-sm text-gray-700 dark:text-slate-300">
                  I don't have a passport
                </label>
              </div>

              <div v-if="formData.rtr.noPassport" class="pl-4 border-l-2 border-primary/30 space-y-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Alternative Document *</label>
                  <select
                    v-model="formData.rtr.alternativeDocType"
                    required
                    class="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary"
                  >
                    <option value="">Select document</option>
                    <option value="birth_certificate">Birth Certificate</option>
                    <option value="driving_licence">Full UK Driving Licence</option>
                  </select>
                </div>
                <FileUpload
                  v-model="formData.rtr.alternativeDoc"
                  label="Upload Alternative Document"
                  required
                  accept=".pdf,.jpg,.jpeg,.png"
                  :uploadUrl="`${API_URL}/api/v2/tenant-form/${token}/upload`"
                  :token="token"
                  section="rtr"
                  @uploaded="handleFileUploaded('rtr', 'alternativeDoc', $event)"
                />
              </div>
            </div>

            <!-- Non-UK - Share Code & Documents -->
            <div v-else-if="formData.rtr.citizenshipStatus && formData.rtr.citizenshipStatus !== 'uk_citizen'" class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Share Code *</label>
                <input
                  v-model="formData.rtr.shareCode"
                  type="text"
                  required
                  placeholder="e.g. ABC123XYZ"
                  class="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white uppercase focus:ring-2 focus:ring-primary/50 focus:border-primary"
                />
                <p class="text-xs text-gray-500 mt-1">
                  Get your share code at <a href="https://gov.uk/view-prove-immigration-status" target="_blank" class="text-primary hover:underline">gov.uk/view-prove-immigration-status</a>
                </p>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Supporting Document Type</label>
                <select
                  v-model="formData.rtr.supportingDocType"
                  class="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary"
                >
                  <option value="">Select document (optional)</option>
                  <option value="brp">Biometric Residence Permit (BRP)</option>
                  <option value="visa">Visa</option>
                  <option value="share_code_screenshot">Share Code Verification Screenshot</option>
                </select>
              </div>

              <FileUpload
                v-if="formData.rtr.supportingDocType"
                v-model="formData.rtr.supportingDoc"
                label="Upload Supporting Document"
                accept=".pdf,.jpg,.jpeg,.png"
                :uploadUrl="`${API_URL}/api/v2/tenant-form/${token}/upload`"
                :token="token"
                section="rtr"
                @uploaded="handleFileUploaded('rtr', 'supportingDoc', $event)"
              />
            </div>
          </div>
        </div>

        <!-- ========== SECTION 3: INCOME ========== -->
        <div v-show="steps[currentStep - 1]?.id === 'income'" class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
          <div class="px-6 py-4 bg-gray-50 dark:bg-slate-700/50 border-b border-gray-200 dark:border-slate-700">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Briefcase class="w-5 h-5 text-primary" />
              Income & Employment
            </h2>
            <p class="text-sm text-gray-600 dark:text-slate-400 mt-1">Provide your employment and income details</p>
          </div>

          <div class="p-6 space-y-5">
            <!-- Income Sources -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Income Sources (select all that apply) *</label>
              <div class="grid grid-cols-2 gap-2">
                <label
                  v-for="source in incomeSourceOptions"
                  :key="source.value"
                  class="flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors"
                  :class="formData.income.sources.includes(source.value)
                    ? 'border-primary bg-primary/5'
                    : 'border-gray-200 dark:border-slate-600 hover:border-gray-300'"
                >
                  <input
                    type="checkbox"
                    :value="source.value"
                    v-model="formData.income.sources"
                    class="w-4 h-4 text-primary rounded"
                  />
                  <span class="text-sm text-gray-700 dark:text-slate-300">{{ source.label }}</span>
                </label>
              </div>
            </div>

            <!-- Employed Details -->
            <div v-if="formData.income.sources.includes('employed')" class="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg space-y-4">
              <h3 class="font-medium text-gray-900 dark:text-white">Employment Details</h3>

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Employer Name *</label>
                  <input
                    v-model="formData.income.employerName"
                    type="text"
                    required
                    class="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Job Title *</label>
                  <input
                    v-model="formData.income.jobTitle"
                    type="text"
                    required
                    class="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Employment Start Date *</label>
                  <input
                    v-model="formData.income.employmentStartDate"
                    type="date"
                    required
                    class="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Annual Salary (£) *</label>
                  <input
                    v-model.number="formData.income.annualSalary"
                    type="number"
                    min="0"
                    required
                    class="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Employer Address</label>
                <textarea
                  v-model="formData.income.employerAddress"
                  rows="2"
                  placeholder="Full employer address"
                  class="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                ></textarea>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">HR/Reference Contact Name</label>
                  <input
                    v-model="formData.income.employerRefName"
                    type="text"
                    class="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">HR/Reference Email</label>
                  <input
                    v-model="formData.income.employerRefEmail"
                    type="email"
                    placeholder="HR or manager email"
                    class="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <FileUpload
                v-model="formData.income.payslips"
                label="Upload Payslips (Last 3 Months)"
                accept=".pdf,.jpg,.jpeg,.png"
                helpText="Upload your most recent 3 payslips to verify income"
                :uploadUrl="`${API_URL}/api/v2/tenant-form/${token}/upload`"
                :token="token"
                section="income"
                @uploaded="handleFileUploaded('income', 'payslips', $event)"
              />
            </div>

            <!-- Self-Employed Details -->
            <div v-if="formData.income.sources.includes('self_employed')" class="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg space-y-4">
              <h3 class="font-medium text-gray-900 dark:text-white">Self-Employment Details</h3>

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Business Name *</label>
                  <input
                    v-model="formData.income.businessName"
                    type="text"
                    required
                    class="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Nature of Business *</label>
                  <input
                    v-model="formData.income.businessNature"
                    type="text"
                    required
                    class="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Business Start Date *</label>
                  <input
                    v-model="formData.income.businessStartDate"
                    type="date"
                    required
                    class="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Annual Income (£) *</label>
                  <input
                    v-model.number="formData.income.selfEmployedIncome"
                    type="number"
                    min="0"
                    required
                    class="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Accountant Name/Firm</label>
                  <input
                    v-model="formData.income.accountantName"
                    type="text"
                    class="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Accountant Email</label>
                  <input
                    v-model="formData.income.accountantEmail"
                    type="email"
                    class="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <FileUpload
                v-model="formData.income.taxReturn"
                label="Upload Tax Return/SA302"
                required
                accept=".pdf,.jpg,.jpeg,.png"
                helpText="Upload your most recent tax return or SA302"
                :uploadUrl="`${API_URL}/api/v2/tenant-form/${token}/upload`"
                :token="token"
                section="income"
                @uploaded="handleFileUploaded('income', 'taxReturn', $event)"
              />
            </div>

            <!-- Benefits -->
            <div v-if="formData.income.sources.includes('benefits')" class="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg space-y-4">
              <h3 class="font-medium text-gray-900 dark:text-white">Benefits Income</h3>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Monthly Benefits Amount (£) *</label>
                <input
                  v-model.number="formData.income.benefitsAmount"
                  type="number"
                  min="0"
                  required
                  class="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                />
              </div>
              <FileUpload
                v-model="formData.income.benefitsDoc"
                label="Upload Benefits Statement"
                accept=".pdf,.jpg,.jpeg,.png"
                helpText="Upload a recent benefits award letter or statement"
                :uploadUrl="`${API_URL}/api/v2/tenant-form/${token}/upload`"
                :token="token"
                section="income"
                @uploaded="handleFileUploaded('income', 'benefitsDoc', $event)"
              />
            </div>

            <!-- Savings -->
            <div v-if="formData.income.sources.includes('savings')" class="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg space-y-4">
              <h3 class="font-medium text-gray-900 dark:text-white">Savings & Investments</h3>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Total Savings (£) *</label>
                <input
                  v-model.number="formData.income.savingsAmount"
                  type="number"
                  min="0"
                  required
                  class="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                />
              </div>
              <FileUpload
                v-model="formData.income.savingsDoc"
                label="Upload Proof of Savings"
                required
                accept=".pdf,.jpg,.jpeg,.png"
                helpText="Upload bank or investment statement showing your savings"
                :uploadUrl="`${API_URL}/api/v2/tenant-form/${token}/upload`"
                :token="token"
                section="income"
                @uploaded="handleFileUploaded('income', 'savingsDoc', $event)"
              />
              <p class="text-xs text-gray-500">Tip: You can redact other transactions for privacy</p>
            </div>

            <!-- Pension -->
            <div v-if="formData.income.sources.includes('pension')" class="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg space-y-4">
              <h3 class="font-medium text-gray-900 dark:text-white">Pension Income</h3>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Monthly Pension (£) *</label>
                  <input
                    v-model.number="formData.income.pensionAmount"
                    type="number"
                    min="0"
                    required
                    class="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Pension Provider</label>
                  <input
                    v-model="formData.income.pensionProvider"
                    type="text"
                    class="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
              <FileUpload
                v-model="formData.income.pensionDoc"
                label="Upload Pension Statement"
                required
                accept=".pdf,.jpg,.jpeg,.png"
                :uploadUrl="`${API_URL}/api/v2/tenant-form/${token}/upload`"
                :token="token"
                section="income"
                @uploaded="handleFileUploaded('income', 'pensionDoc', $event)"
              />
            </div>

            <!-- Student -->
            <div v-if="formData.income.sources.includes('student')" class="p-4 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg space-y-4">
              <h3 class="font-medium text-gray-900 dark:text-white">Student Details</h3>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">University/College *</label>
                  <input
                    v-model="formData.income.university"
                    type="text"
                    required
                    class="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Course *</label>
                  <input
                    v-model="formData.income.course"
                    type="text"
                    required
                    class="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
              <FileUpload
                v-model="formData.income.studentDoc"
                label="Upload Student ID or Enrollment Letter"
                accept=".pdf,.jpg,.jpeg,.png"
                :uploadUrl="`${API_URL}/api/v2/tenant-form/${token}/upload`"
                :token="token"
                section="income"
                @uploaded="handleFileUploaded('income', 'studentDoc', $event)"
              />

              <!-- Guarantor suggestion for students -->
              <div class="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <p class="text-sm text-amber-800 dark:text-amber-300">
                  <strong>Note:</strong> Students typically require a guarantor. You'll be asked to provide guarantor details in a later section.
                </p>
              </div>
            </div>

            <!-- Total Annual Income Summary -->
            <div class="p-4 bg-gray-100 dark:bg-slate-700 rounded-lg">
              <div class="flex justify-between items-center">
                <span class="font-medium text-gray-900 dark:text-white">Total Annual Income</span>
                <span class="text-xl font-bold text-primary">£{{ calculatedAnnualIncome.toLocaleString() }}</span>
              </div>
              <p class="text-xs text-gray-500 dark:text-slate-400 mt-1">
                Based on the income sources you've provided
              </p>
            </div>
          </div>
        </div>

        <!-- ========== SECTION 4: RESIDENTIAL HISTORY ========== -->
        <div v-show="steps[currentStep - 1]?.id === 'residential'" class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
          <div class="px-6 py-4 bg-gray-50 dark:bg-slate-700/50 border-b border-gray-200 dark:border-slate-700">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Home class="w-5 h-5 text-primary" />
              Residential History
            </h2>
            <p class="text-sm text-gray-600 dark:text-slate-400 mt-1">Provide 3 years of address history</p>
          </div>

          <div class="p-6 space-y-5">
            <!-- Current Address -->
            <div class="space-y-4">
              <h3 class="font-medium text-gray-900 dark:text-white">Current Address</h3>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Address Line 1 *</label>
                <input
                  v-model="formData.residential.currentAddress.line1"
                  type="text"
                  required
                  placeholder="House number and street"
                  class="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Address Line 2</label>
                <input
                  v-model="formData.residential.currentAddress.line2"
                  type="text"
                  placeholder="Apartment, flat, etc."
                  class="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                />
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">City *</label>
                  <input
                    v-model="formData.residential.currentAddress.city"
                    type="text"
                    required
                    class="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Postcode *</label>
                  <input
                    v-model="formData.residential.currentAddress.postcode"
                    type="text"
                    required
                    class="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Years at Address *</label>
                  <input
                    v-model.number="formData.residential.currentAddress.years"
                    type="number"
                    min="0"
                    max="50"
                    required
                    class="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Months *</label>
                  <input
                    v-model.number="formData.residential.currentAddress.months"
                    type="number"
                    min="0"
                    max="11"
                    required
                    class="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <FileUpload
                v-model="formData.residential.proofOfAddress"
                label="Proof of Address"
                accept=".pdf,.jpg,.jpeg,.png"
                helpText="Bank statement, utility bill, or council tax bill (dated within 3 months)"
                :uploadUrl="`${API_URL}/api/v2/tenant-form/${token}/upload`"
                :token="token"
                section="residential"
                @uploaded="handleFileUploaded('residential', 'proofOfAddress', $event)"
              />
            </div>

            <!-- Address History Progress -->
            <div class="p-3 rounded-lg" :class="addressHistoryMonths >= 36 ? 'bg-green-100 dark:bg-green-900/30' : 'bg-amber-100 dark:bg-amber-900/30'">
              <div class="flex items-center justify-between">
                <span class="text-sm font-medium" :class="addressHistoryMonths >= 36 ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'">
                  Address History: {{ addressHistoryMonths }} of 36 months
                </span>
                <span class="text-xs" :class="addressHistoryMonths >= 36 ? 'text-green-600' : 'text-amber-600'">
                  {{ addressHistoryMonths >= 36 ? '✓ Complete' : `${36 - addressHistoryMonths} more months needed` }}
                </span>
              </div>
              <div class="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2 mt-2">
                <div
                  class="h-2 rounded-full transition-all"
                  :class="addressHistoryMonths >= 36 ? 'bg-green-500' : 'bg-amber-500'"
                  :style="{ width: Math.min(addressHistoryMonths / 36 * 100, 100) + '%' }"
                ></div>
              </div>
            </div>

            <!-- Previous Addresses -->
            <div v-if="addressHistoryMonths < 36" class="space-y-4">
              <div class="flex items-center justify-between">
                <h3 class="font-medium text-gray-900 dark:text-white">Previous Addresses</h3>
                <button
                  type="button"
                  @click="addPreviousAddress"
                  class="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  <Plus class="w-4 h-4" />
                  Add Address
                </button>
              </div>

              <div
                v-for="(addr, index) in formData.residential.previousAddresses"
                :key="index"
                class="p-4 border border-gray-200 dark:border-slate-600 rounded-lg space-y-3"
              >
                <div class="flex items-center justify-between">
                  <span class="text-sm font-medium text-gray-700 dark:text-slate-300">Previous Address {{ index + 1 }}</span>
                  <button
                    type="button"
                    @click="removePreviousAddress(index)"
                    class="text-red-500 hover:text-red-700"
                  >
                    <Trash2 class="w-4 h-4" />
                  </button>
                </div>

                <div>
                  <input
                    v-model="addr.line1"
                    type="text"
                    placeholder="Address Line 1"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white text-sm"
                  />
                </div>

                <div class="grid grid-cols-2 gap-3">
                  <input
                    v-model="addr.city"
                    type="text"
                    placeholder="City"
                    class="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white text-sm"
                  />
                  <input
                    v-model="addr.postcode"
                    type="text"
                    placeholder="Postcode"
                    class="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white text-sm"
                  />
                </div>

                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label class="text-xs text-gray-500">Years</label>
                    <input
                      v-model.number="addr.years"
                      type="number"
                      min="0"
                      max="50"
                      class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white text-sm"
                    />
                  </div>
                  <div>
                    <label class="text-xs text-gray-500">Months</label>
                    <input
                      v-model.number="addr.months"
                      type="number"
                      min="0"
                      max="11"
                      class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white text-sm"
                    />
                  </div>
                </div>

                <div>
                  <input
                    v-model="addr.landlordEmail"
                    type="email"
                    placeholder="Previous landlord email (for reference)"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white text-sm"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ========== SECTION 5: PERSONAL INFORMATION ========== -->
        <div v-show="steps[currentStep - 1]?.id === 'personal'" class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
          <div class="px-6 py-4 bg-gray-50 dark:bg-slate-700/50 border-b border-gray-200 dark:border-slate-700">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <UserCircle class="w-5 h-5 text-primary" />
              Personal Information
            </h2>
            <p class="text-sm text-gray-600 dark:text-slate-400 mt-1">Additional details about your circumstances</p>
          </div>

          <div class="p-6 space-y-5">
            <!-- Smoker -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Do you smoke? *</label>
              <div class="flex gap-4">
                <label class="flex items-center gap-2">
                  <input v-model="formData.personal.smoker" type="radio" :value="true" class="text-primary" />
                  <span class="text-sm text-gray-700 dark:text-slate-300">Yes</span>
                </label>
                <label class="flex items-center gap-2">
                  <input v-model="formData.personal.smoker" type="radio" :value="false" class="text-primary" />
                  <span class="text-sm text-gray-700 dark:text-slate-300">No</span>
                </label>
              </div>
            </div>

            <!-- Pets -->
            <div>
              <label class="flex items-center gap-2 mb-2">
                <input v-model="formData.personal.hasPets" type="checkbox" class="w-4 h-4 text-primary rounded" />
                <span class="text-sm font-medium text-gray-700 dark:text-slate-300">I have pets</span>
              </label>
              <div v-if="formData.personal.hasPets" class="pl-6">
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Pet Details *</label>
                <textarea
                  v-model="formData.personal.petDetails"
                  rows="2"
                  required
                  placeholder="Type, breed, size, etc."
                  class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                ></textarea>
              </div>
            </div>

            <!-- Marital Status -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Marital Status</label>
              <select
                v-model="formData.personal.maritalStatus"
                class="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
              >
                <option value="">Select status</option>
                <option value="single">Single</option>
                <option value="married">Married</option>
                <option value="divorced">Divorced</option>
                <option value="widowed">Widowed</option>
                <option value="civil_partnership">Civil Partnership</option>
                <option value="other">Other</option>
              </select>
            </div>

            <!-- Dependants -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Number of Dependants</label>
              <input
                v-model.number="formData.personal.dependants"
                type="number"
                min="0"
                class="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
              />
              <div v-if="formData.personal.dependants > 0" class="mt-3">
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Dependants Details</label>
                <textarea
                  v-model="formData.personal.dependantsDetails"
                  rows="2"
                  placeholder="Ages, relationship, etc."
                  class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                ></textarea>
              </div>
            </div>

            <!-- Adverse Credit -->
            <div class="pt-4 border-t border-gray-200 dark:border-slate-700">
              <label class="flex items-center gap-2 mb-2">
                <input v-model="formData.personal.hasAdverseCredit" type="checkbox" class="w-4 h-4 text-primary rounded" />
                <span class="text-sm font-medium text-gray-700 dark:text-slate-300">I have adverse credit history</span>
              </label>
              <div v-if="formData.personal.hasAdverseCredit" class="pl-6">
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Please explain *</label>
                <textarea
                  v-model="formData.personal.adverseCreditDetails"
                  rows="3"
                  required
                  placeholder="Please explain any CCJs, defaults, bankruptcies, or other adverse credit events..."
                  class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                ></textarea>
              </div>
            </div>
          </div>
        </div>

        <!-- ========== SECTION 6: GUARANTOR (Conditional) ========== -->
        <div v-show="steps[currentStep - 1]?.id === 'guarantor'" class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
          <div class="px-6 py-4 bg-gray-50 dark:bg-slate-700/50 border-b border-gray-200 dark:border-slate-700">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Users class="w-5 h-5 text-primary" />
              Guarantor Details
            </h2>
            <p class="text-sm text-gray-600 dark:text-slate-400 mt-1">Provide details of someone who can act as your guarantor</p>
          </div>

          <div class="p-6 space-y-5">
            <div class="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p class="text-sm text-blue-800 dark:text-blue-300">
                A guarantor is typically required for students, those on low income, or if requested by the landlord. They must be a UK homeowner with sufficient income.
              </p>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Guarantor First Name *</label>
                <input
                  v-model="formData.guarantor.firstName"
                  type="text"
                  required
                  class="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Guarantor Last Name *</label>
                <input
                  v-model="formData.guarantor.lastName"
                  type="text"
                  required
                  class="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Guarantor Email *</label>
              <input
                v-model="formData.guarantor.email"
                type="email"
                required
                class="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
              />
              <p class="text-xs text-gray-500 mt-1">We'll send them a reference form to complete</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Guarantor Phone *</label>
              <input
                v-model="formData.guarantor.phone"
                type="tel"
                required
                class="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Relationship to You *</label>
              <select
                v-model="formData.guarantor.relationship"
                required
                class="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
              >
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
          </div>
        </div>

        <!-- ========== SECTION 7: DEPOSIT OPTIONS ========== -->
        <div v-show="steps[currentStep - 1]?.id === 'deposit'" class="space-y-6">
          <!-- Reposit Branded Card -->
          <div class="rounded-xl border-2 border-[#00B4B4] overflow-hidden">
            <!-- Header with Logo -->
            <div class="bg-white dark:bg-slate-800 px-6 py-4 border-b border-[#00B4B4]/30 flex items-center justify-between">
              <img
                src="https://d1jj9i760ttpd.cloudfront.net/logos/primary/primary-full-colour.png"
                alt="Reposit"
                class="h-8 w-auto"
              />
              <a
                href="https://reposit.co.uk/tenants/"
                target="_blank"
                class="text-xs text-[#1a365d] hover:text-[#00B4B4] flex items-center gap-1"
              >
                Learn more
                <ExternalLink class="w-3 h-3" />
              </a>
            </div>

            <!-- Content -->
            <div class="bg-gradient-to-br from-[#00B4B4]/5 to-[#0891b2]/10 dark:from-[#00B4B4]/10 dark:to-[#0891b2]/20 p-6">
              <!-- When Reposit is OFFERED by landlord -->
              <template v-if="reference?.deposit_replacement_offered">
                <div class="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 mb-6">
                  <p class="text-emerald-800 dark:text-emerald-300 font-semibold text-lg">
                    Save £{{ repositSavings.toFixed(2) }} on upfront move-in costs
                  </p>
                  <p class="text-sm text-emerald-700 dark:text-emerald-400 mt-1">
                    Your landlord has agreed to offer Reposit as an alternative to a traditional cash deposit
                  </p>
                </div>

                <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">Select your tenancy deposit option</h2>
                <p class="text-sm text-gray-600 dark:text-slate-400 mb-6">
                  Choose between a traditional cash deposit or an alternative that helps you save on upfront renting costs.
                </p>

                <div class="grid md:grid-cols-2 gap-4 mb-6">
                  <!-- Reposit Option -->
                  <div
                    @click="formData.deposit.repositConfirmed = true"
                    class="relative border-2 rounded-xl p-5 cursor-pointer transition-all bg-white dark:bg-slate-800"
                    :class="formData.deposit.repositConfirmed === true
                      ? 'border-[#00B4B4] ring-2 ring-[#00B4B4]/20'
                      : 'border-gray-200 dark:border-slate-600 hover:border-[#00B4B4]/50'"
                  >
                    <div class="absolute -top-3 left-4">
                      <span class="bg-[#00B4B4] text-white text-xs font-semibold px-3 py-1 rounded-full">Recommended</span>
                    </div>

                    <div class="flex items-center justify-between mb-4 mt-2">
                      <h3 class="font-semibold text-gray-900 dark:text-white">Deposit alternative</h3>
                      <img src="https://d1jj9i760ttpd.cloudfront.net/logos/primary/primary-full-colour.png" alt="Reposit" class="h-5" />
                    </div>

                    <p class="text-sm text-gray-600 dark:text-slate-400 mb-4">
                      Pay a small, one-time fee instead of a large upfront cash deposit.
                    </p>

                    <div class="space-y-2 text-sm border-t border-gray-200 dark:border-slate-600 pt-4">
                      <div class="flex justify-between">
                        <span class="text-gray-600 dark:text-slate-400">First month's rent</span>
                        <span class="font-medium text-gray-900 dark:text-white">£{{ (reference?.monthly_rent || 0).toFixed(2) }}</span>
                      </div>
                      <div class="flex justify-between">
                        <span class="text-gray-600 dark:text-slate-400">Reposit fee</span>
                        <span class="font-medium text-[#00B4B4]">£{{ repositFee.toFixed(2) }}*</span>
                      </div>
                      <div class="flex justify-between pt-2 border-t border-gray-200 dark:border-slate-600">
                        <span class="font-semibold text-gray-900 dark:text-white">Total upfront</span>
                        <span class="font-bold text-[#1a365d] dark:text-[#00B4B4]">£{{ ((reference?.monthly_rent || 0) + repositFee).toFixed(2) }}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      class="w-full mt-4 py-2.5 rounded-lg font-medium transition-colors"
                      :class="formData.deposit.repositConfirmed === true
                        ? 'bg-[#1a365d] text-white'
                        : 'bg-[#00B4B4]/20 text-[#1a365d] hover:bg-[#00B4B4]/30'"
                    >
                      {{ formData.deposit.repositConfirmed === true ? '✓ Selected' : 'Choose Reposit' }}
                    </button>
                    <p class="text-xs text-gray-500 mt-2 text-center">*Non-refundable</p>
                  </div>

                  <!-- Traditional Deposit -->
                  <div
                    @click="formData.deposit.repositConfirmed = false"
                    class="border-2 rounded-xl p-5 cursor-pointer transition-all bg-white dark:bg-slate-800"
                    :class="formData.deposit.repositConfirmed === false
                      ? 'border-gray-500 ring-2 ring-gray-200'
                      : 'border-gray-200 dark:border-slate-600 hover:border-gray-400'"
                  >
                    <div class="flex items-center justify-between mb-4">
                      <h3 class="font-semibold text-gray-900 dark:text-white">Traditional cash deposit</h3>
                    </div>

                    <p class="text-sm text-gray-600 dark:text-slate-400 mb-4">
                      Pay a traditional cash deposit - usually five weeks' rent.
                    </p>

                    <div class="space-y-2 text-sm border-t border-gray-200 dark:border-slate-600 pt-4">
                      <div class="flex justify-between">
                        <span class="text-gray-600 dark:text-slate-400">First month's rent</span>
                        <span class="font-medium text-gray-900 dark:text-white">£{{ (reference?.monthly_rent || 0).toFixed(2) }}</span>
                      </div>
                      <div class="flex justify-between">
                        <span class="text-gray-600 dark:text-slate-400">Traditional deposit</span>
                        <span class="font-medium text-gray-900 dark:text-white">£{{ (reference?.deposit_amount || 0).toFixed(2) }}*</span>
                      </div>
                      <div class="flex justify-between pt-2 border-t border-gray-200 dark:border-slate-600">
                        <span class="font-semibold text-gray-900 dark:text-white">Total upfront</span>
                        <span class="font-bold text-gray-900 dark:text-white">£{{ ((reference?.monthly_rent || 0) + (reference?.deposit_amount || 0)).toFixed(2) }}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      class="w-full mt-4 py-2.5 rounded-lg font-medium transition-colors"
                      :class="formData.deposit.repositConfirmed === false
                        ? 'bg-gray-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'"
                    >
                      {{ formData.deposit.repositConfirmed === false ? '✓ Selected' : 'Choose traditional deposit' }}
                    </button>
                    <p class="text-xs text-gray-500 mt-2 text-center">*Refundable at end of tenancy</p>
                  </div>
                </div>
              </template>

              <!-- When Reposit is NOT offered - Sales Pitch -->
              <template v-else>
                <div class="text-center mb-6">
                  <h2 class="text-2xl font-bold text-[#1a365d] dark:text-white mb-2">
                    Want to save on your deposit?
                  </h2>
                  <p class="text-gray-600 dark:text-slate-400">
                    Reposit is a deposit replacement that could save you hundreds of pounds in upfront costs.
                  </p>
                </div>

                <!-- Savings Highlight -->
                <div class="bg-white dark:bg-slate-800 rounded-xl p-6 mb-6 border border-[#00B4B4]/30">
                  <div class="grid md:grid-cols-2 gap-6">
                    <div class="text-center p-4 bg-gray-50 dark:bg-slate-700 rounded-lg">
                      <p class="text-sm text-gray-500 dark:text-slate-400 mb-1">Traditional Deposit</p>
                      <p class="text-2xl font-bold text-gray-400 line-through">£{{ (reference?.deposit_amount || 0).toFixed(2) }}</p>
                    </div>
                    <div class="text-center p-4 bg-[#00B4B4]/10 rounded-lg border-2 border-[#00B4B4]">
                      <p class="text-sm text-[#0e7490] dark:text-[#00B4B4] mb-1">Reposit Fee</p>
                      <p class="text-2xl font-bold text-[#1a365d] dark:text-[#00B4B4]">£{{ repositFee.toFixed(2) }}</p>
                    </div>
                  </div>
                  <div class="mt-4 text-center">
                    <p class="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                      Potential savings: £{{ repositSavings.toFixed(2) }}
                    </p>
                  </div>
                </div>

                <!-- Benefits -->
                <div class="grid md:grid-cols-3 gap-4 mb-6">
                  <div class="bg-white dark:bg-slate-800 rounded-lg p-4 text-center">
                    <div class="w-10 h-10 bg-[#00B4B4]/20 rounded-full flex items-center justify-center mx-auto mb-2">
                      <Wallet class="w-5 h-5 text-[#00B4B4]" />
                    </div>
                    <h4 class="font-medium text-gray-900 dark:text-white text-sm">Save Money</h4>
                    <p class="text-xs text-gray-500 dark:text-slate-400 mt-1">Pay just one week's rent instead of five</p>
                  </div>
                  <div class="bg-white dark:bg-slate-800 rounded-lg p-4 text-center">
                    <div class="w-10 h-10 bg-[#00B4B4]/20 rounded-full flex items-center justify-center mx-auto mb-2">
                      <Shield class="w-5 h-5 text-[#00B4B4]" />
                    </div>
                    <h4 class="font-medium text-gray-900 dark:text-white text-sm">Same Protection</h4>
                    <p class="text-xs text-gray-500 dark:text-slate-400 mt-1">Landlord gets full deposit equivalent cover</p>
                  </div>
                  <div class="bg-white dark:bg-slate-800 rounded-lg p-4 text-center">
                    <div class="w-10 h-10 bg-[#00B4B4]/20 rounded-full flex items-center justify-center mx-auto mb-2">
                      <CheckCircle class="w-5 h-5 text-[#00B4B4]" />
                    </div>
                    <h4 class="font-medium text-gray-900 dark:text-white text-sm">Quick & Easy</h4>
                    <p class="text-xs text-gray-500 dark:text-slate-400 mt-1">Sign up online in minutes</p>
                  </div>
                </div>

                <!-- Options -->
                <div class="space-y-3">
                  <!-- Interest in Reposit -->
                  <div
                    @click="formData.deposit.repositInterested = true"
                    class="bg-white dark:bg-slate-800 rounded-xl p-5 cursor-pointer transition-all border-2"
                    :class="formData.deposit.repositInterested
                      ? 'border-[#00B4B4] ring-2 ring-[#00B4B4]/20'
                      : 'border-gray-200 dark:border-slate-600 hover:border-[#00B4B4]/50'"
                  >
                    <div class="flex items-start gap-4">
                      <div
                        class="w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors"
                        :class="formData.deposit.repositInterested
                          ? 'bg-[#00B4B4] border-[#00B4B4]'
                          : 'border-gray-300 dark:border-slate-500'"
                      >
                        <div v-if="formData.deposit.repositInterested" class="w-2 h-2 bg-white rounded-full" />
                      </div>
                      <div class="flex-1">
                        <div class="flex items-center justify-between">
                          <h4 class="font-semibold text-gray-900 dark:text-white">
                            Yes, I'm interested in using Reposit
                          </h4>
                          <span class="text-[#00B4B4] font-bold">£{{ repositFee.toFixed(2) }}</span>
                        </div>
                        <p class="text-sm text-gray-600 dark:text-slate-400 mt-1">
                          I'd like {{ companyName }} to set up Reposit for my tenancy so I can save on my upfront costs.
                        </p>
                      </div>
                    </div>
                  </div>

                  <!-- Traditional Deposit Option -->
                  <div
                    @click="formData.deposit.repositInterested = false"
                    class="bg-white dark:bg-slate-800 rounded-xl p-5 cursor-pointer transition-all border-2"
                    :class="!formData.deposit.repositInterested
                      ? 'border-gray-500 ring-2 ring-gray-200'
                      : 'border-gray-200 dark:border-slate-600 hover:border-gray-400'"
                  >
                    <div class="flex items-start gap-4">
                      <div
                        class="w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors"
                        :class="!formData.deposit.repositInterested
                          ? 'bg-gray-500 border-gray-500'
                          : 'border-gray-300 dark:border-slate-500'"
                      >
                        <div v-if="!formData.deposit.repositInterested" class="w-2 h-2 bg-white rounded-full" />
                      </div>
                      <div class="flex-1">
                        <div class="flex items-center justify-between">
                          <h4 class="font-semibold text-gray-900 dark:text-white">
                            No thanks, I'll pay the traditional deposit
                          </h4>
                          <span class="text-gray-600 dark:text-slate-400 font-bold">£{{ (reference?.deposit_amount || 0).toFixed(2) }}</span>
                        </div>
                        <p class="text-sm text-gray-600 dark:text-slate-400 mt-1">
                          I'll pay a cash deposit of five weeks' rent, refundable at the end of my tenancy.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <p class="text-xs text-gray-500 dark:text-slate-400 text-center mt-4">
                  No obligation - your letting agent will confirm if Reposit is available for your tenancy.
                </p>
              </template>
            </div>
          </div>

          <!-- How Reposit Works -->
          <div class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">How does Reposit work?</h3>
            <ul class="space-y-3 text-sm text-gray-600 dark:text-slate-400">
              <li class="flex items-start gap-2">
                <span class="text-[#00B4B4] mt-0.5">•</span>
                <span>Reposit is a <strong>no deposit</strong> option. By purchasing a Reposit, you pay a service charge equal to one week's rent to avoid paying a cash deposit.</span>
              </li>
              <li class="flex items-start gap-2">
                <span class="text-[#00B4B4] mt-0.5">•</span>
                <span>The Reposit service charge is <strong>non-refundable</strong> and cannot be off-set at end of tenancy.</span>
              </li>
              <li class="flex items-start gap-2">
                <span class="text-[#00B4B4] mt-0.5">•</span>
                <span>You remain fully responsible for the property condition and rent payments. Any charges at tenancy end will be your responsibility.</span>
              </li>
              <li class="flex items-start gap-2">
                <span class="text-[#00B4B4] mt-0.5">•</span>
                <span>Defaulting on liabilities could impact your credit history.</span>
              </li>
            </ul>
            <div class="mt-4 pt-4 border-t border-gray-200 dark:border-slate-700">
              <a href="https://reposit.co.uk/tenants/" target="_blank" class="text-[#00B4B4] hover:text-[#1a365d] text-sm font-medium flex items-center gap-1">
                Learn more about Reposit
                <ExternalLink class="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>

        <!-- ========== SECTION 8: CONSENT & SIGNATURE ========== -->
        <div v-show="steps[currentStep - 1]?.id === 'consent'" class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
          <div class="px-6 py-4 bg-gray-50 dark:bg-slate-700/50 border-b border-gray-200 dark:border-slate-700">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <FileSignature class="w-5 h-5 text-primary" />
              Consent & Declaration
            </h2>
            <p class="text-sm text-gray-600 dark:text-slate-400 mt-1">Please read carefully and sign below</p>
          </div>

          <div class="p-6 space-y-5">
            <!-- Legal Declaration -->
            <div class="max-h-48 overflow-y-auto p-4 bg-gray-50 dark:bg-slate-700 rounded-lg text-sm text-gray-700 dark:text-slate-300 space-y-3">
              <p>By signing below, I confirm and agree to the following:</p>
              <ul class="list-disc list-inside space-y-2">
                <li>All information I have provided is true, complete, and accurate to the best of my knowledge.</li>
                <li>I consent to credit referencing agencies being contacted to verify my credit history.</li>
                <li>I consent to anti-money laundering (AML) checks being performed.</li>
                <li>I authorize the referees I have provided (employers, landlords, accountants) to be contacted.</li>
                <li>I understand that providing false information may result in tenancy refusal or termination under Housing Act 1996, Ground 17.</li>
                <li>I consent to my personal data being processed for the purpose of this tenancy reference in accordance with GDPR.</li>
                <li>I understand that my information may be shared with law enforcement if required by law.</li>
              </ul>
            </div>

            <!-- Consent Checkboxes -->
            <div class="space-y-3">
              <label class="flex items-start gap-3 p-3 bg-gray-50 dark:bg-slate-700 rounded-lg cursor-pointer">
                <input v-model="formData.consent.creditCheck" type="checkbox" class="mt-1 w-4 h-4 text-primary rounded" />
                <span class="text-sm text-gray-700 dark:text-slate-300">
                  I consent to a credit check being performed as part of this reference *
                </span>
              </label>

              <label class="flex items-start gap-3 p-3 bg-gray-50 dark:bg-slate-700 rounded-lg cursor-pointer">
                <input v-model="formData.consent.amlCheck" type="checkbox" class="mt-1 w-4 h-4 text-primary rounded" />
                <span class="text-sm text-gray-700 dark:text-slate-300">
                  I consent to anti-money laundering (AML) checks being performed *
                </span>
              </label>

              <label class="flex items-start gap-3 p-3 bg-gray-50 dark:bg-slate-700 rounded-lg cursor-pointer">
                <input v-model="formData.consent.dataProcessing" type="checkbox" class="mt-1 w-4 h-4 text-primary rounded" />
                <span class="text-sm text-gray-700 dark:text-slate-300">
                  I agree to the processing of my personal data for tenancy referencing purposes *
                </span>
              </label>

              <label class="flex items-start gap-3 p-3 bg-gray-50 dark:bg-slate-700 rounded-lg cursor-pointer">
                <input v-model="formData.consent.declaration" type="checkbox" class="mt-1 w-4 h-4 text-primary rounded" />
                <span class="text-sm text-gray-700 dark:text-slate-300">
                  I declare that all information provided is true and accurate to the best of my knowledge *
                </span>
              </label>
            </div>

            <!-- Signature -->
            <div class="pt-4 border-t border-gray-200 dark:border-slate-700">
              <SignaturePad
                v-model="formData.consent.signature"
                label="Your Signature"
                required
              />
            </div>

            <!-- Printed Name & Date -->
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Printed Name *</label>
                <input
                  v-model="formData.consent.printedName"
                  type="text"
                  required
                  class="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Date</label>
                <input
                  :value="new Date().toLocaleDateString('en-GB')"
                  type="text"
                  disabled
                  class="w-full px-3 py-2.5 border border-gray-200 dark:border-slate-700 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Navigation -->
        <div class="flex justify-between pt-4">
          <button
            v-if="currentStep > 1"
            type="button"
            @click="previousStep"
            class="px-6 py-2.5 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-2"
          >
            <ChevronLeft class="w-4 h-4" />
            Back
          </button>
          <div v-else></div>

          <button
            v-if="currentStep < totalSteps"
            type="button"
            @click="nextStep"
            :disabled="!canProceed"
            class="px-6 py-2.5 text-white rounded-lg transition-all disabled:opacity-50 flex items-center gap-2"
            :style="{ backgroundColor: buttonColor }"
          >
            Continue
            <ChevronRight class="w-4 h-4" />
          </button>

          <button
            v-else
            type="submit"
            :disabled="!canSubmit || submitting"
            class="px-8 py-2.5 text-white rounded-lg transition-all disabled:opacity-50 flex items-center gap-2"
            :style="{ backgroundColor: buttonColor }"
          >
            <Loader2 v-if="submitting" class="w-4 h-4 animate-spin" />
            <span v-else>Submit Reference</span>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import {
  Loader2, CheckCircle, AlertCircle, User, Shield, Briefcase, Home,
  UserCircle, Users, FileSignature, ChevronLeft, ChevronRight, Plus, Trash2, Camera,
  Wallet, ExternalLink
} from 'lucide-vue-next'
import FileUpload from '@/components/forms/FileUpload.vue'
import SignaturePad from '@/components/forms/SignaturePad.vue'
import DeviceHandoffGate from '@/components/DeviceHandoffGate.vue'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const route = useRoute()
const token = computed(() => route.params.token as string)

const loading = ref(true)
const error = ref('')
const submitting = ref(false)
const submitted = ref(false)

const reference = ref<any>(null)
const companyName = ref('')
const companyLogo = ref('')
const companyPhone = ref('')
const companyEmail = ref('')
const companyAddress = ref('')
const companyWebsite = ref('')
const primaryColor = ref('#f97316')
const buttonColor = ref('#f97316')

// Device handoff gate
const showDeviceGate = ref(true)
const deviceGateTitle = ref('Complete Your Reference')
const deviceGateDescription = ref('')

// Camera capture for selfie
const showCameraStream = ref(false)
const videoElement = ref<HTMLVideoElement | null>(null)
const canvasElement = ref<HTMLCanvasElement | null>(null)
const cameraStream = ref<MediaStream | null>(null)
const cameraError = ref('')
const selfiePreview = ref<string | null>(null)
const selfieFile = ref<File | null>(null)
const selfieUploaded = ref(false)
const selfieUploading = ref(false)

const currentStep = ref(1)

const incomeSourceOptions = [
  { value: 'employed', label: 'Employed' },
  { value: 'self_employed', label: 'Self-Employed' },
  { value: 'benefits', label: 'Benefits' },
  { value: 'savings', label: 'Savings' },
  { value: 'pension', label: 'Pension' },
  { value: 'student', label: 'Student' },
  { value: 'unemployed', label: 'Unemployed' }
]

// Dynamic steps
const steps = computed(() => {
  const baseSteps = [
    { id: 'identity', label: 'Identity' },
    { id: 'rtr', label: 'Right to Rent' },
    { id: 'income', label: 'Income' },
    { id: 'residential', label: 'Address' },
    { id: 'personal', label: 'Personal' }
  ]

  // Add guarantor step if student or unemployed
  if (needsGuarantor.value) {
    baseSteps.push({ id: 'guarantor', label: 'Guarantor' })
  }

  // Always show deposit step - either as choice (if offered) or as sales pitch
  baseSteps.push({ id: 'deposit', label: 'Deposit Options' })

  baseSteps.push({ id: 'consent', label: 'Consent' })
  return baseSteps
})

const totalSteps = computed(() => steps.value.length)

const needsGuarantor = computed(() => {
  return formData.value.income.sources.includes('student') ||
         formData.value.income.sources.includes('unemployed')
})

const formData = ref({
  identity: {
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    phone: '',
    documentType: '',
    idDocument: null as File | null,
    idDocumentUrl: '',
    selfie: null as File | null,
    selfieUrl: ''
  },
  rtr: {
    citizenshipStatus: '',
    passportDoc: null as File | null,
    passportDocUrl: '',
    noPassport: false,
    alternativeDocType: '',
    alternativeDoc: null as File | null,
    alternativeDocUrl: '',
    shareCode: '',
    supportingDocType: '',
    supportingDoc: null as File | null,
    supportingDocUrl: ''
  },
  income: {
    sources: [] as string[],
    // Employed
    employerName: '',
    jobTitle: '',
    employmentStartDate: '',
    annualSalary: null as number | null,
    employerAddress: '',
    employerRefName: '',
    employerRefEmail: '',
    payslips: null as File | null,
    payslipsUrl: '',
    // Self-employed
    businessName: '',
    businessNature: '',
    businessStartDate: '',
    selfEmployedIncome: null as number | null,
    accountantName: '',
    accountantEmail: '',
    taxReturn: null as File | null,
    taxReturnUrl: '',
    // Benefits
    benefitsAmount: null as number | null,
    benefitsDoc: null as File | null,
    benefitsDocUrl: '',
    // Savings
    savingsAmount: null as number | null,
    savingsDoc: null as File | null,
    savingsDocUrl: '',
    // Pension
    pensionAmount: null as number | null,
    pensionProvider: '',
    pensionDoc: null as File | null,
    pensionDocUrl: '',
    // Student
    university: '',
    course: '',
    studentDoc: null as File | null,
    studentDocUrl: ''
  },
  residential: {
    currentAddress: {
      line1: '',
      line2: '',
      city: '',
      postcode: '',
      years: 0,
      months: 0
    },
    proofOfAddress: null as File | null,
    proofOfAddressUrl: '',
    previousAddresses: [] as Array<{
      line1: string
      line2: string
      city: string
      postcode: string
      years: number
      months: number
      landlordEmail: string
    }>
  },
  personal: {
    smoker: null as boolean | null,
    hasPets: false,
    petDetails: '',
    maritalStatus: '',
    dependants: 0,
    dependantsDetails: '',
    hasAdverseCredit: false,
    adverseCreditDetails: ''
  },
  guarantor: {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    relationship: ''
  },
  deposit: {
    repositConfirmed: null as boolean | null,
    repositInterested: false
  },
  consent: {
    creditCheck: false,
    amlCheck: false,
    dataProcessing: false,
    declaration: false,
    signature: null as string | null,
    printedName: ''
  }
})

// Computed: Calculate total address history in months
const addressHistoryMonths = computed(() => {
  let total = (formData.value.residential.currentAddress.years || 0) * 12 +
              (formData.value.residential.currentAddress.months || 0)

  for (const addr of formData.value.residential.previousAddresses) {
    total += (addr.years || 0) * 12 + (addr.months || 0)
  }

  return total
})

// Computed: Calculate annual income
const calculatedAnnualIncome = computed(() => {
  let total = 0

  if (formData.value.income.sources.includes('employed') && formData.value.income.annualSalary) {
    total += formData.value.income.annualSalary
  }
  if (formData.value.income.sources.includes('self_employed') && formData.value.income.selfEmployedIncome) {
    total += formData.value.income.selfEmployedIncome
  }
  if (formData.value.income.sources.includes('benefits') && formData.value.income.benefitsAmount) {
    total += formData.value.income.benefitsAmount * 12
  }
  if (formData.value.income.sources.includes('pension') && formData.value.income.pensionAmount) {
    total += formData.value.income.pensionAmount * 12
  }

  return total
})

const repositFee = computed(() => {
  if (!reference.value?.monthly_rent) return 0
  return Math.round(reference.value.monthly_rent / 4.33 * 100) / 100
})

const repositSavings = computed(() => {
  if (!reference.value?.deposit_amount) return 0
  return Math.round((reference.value.deposit_amount - repositFee.value) * 100) / 100
})

const canProceed = computed(() => {
  const currentStepId = steps.value[currentStep.value - 1]?.id

  switch (currentStepId) {
    case 'identity':
      return formData.value.identity.firstName &&
             formData.value.identity.lastName &&
             formData.value.identity.dateOfBirth &&
             formData.value.identity.documentType &&
             (selfieUploaded.value || formData.value.identity.selfieUrl)
    case 'rtr':
      if (!formData.value.rtr.citizenshipStatus) return false
      if (formData.value.rtr.citizenshipStatus !== 'uk_citizen' && !formData.value.rtr.shareCode) return false
      return true
    case 'income':
      return formData.value.income.sources.length > 0
    case 'residential':
      return formData.value.residential.currentAddress.line1 &&
             formData.value.residential.currentAddress.city &&
             formData.value.residential.currentAddress.postcode
    case 'personal':
      return formData.value.personal.smoker !== null
    case 'guarantor':
      return formData.value.guarantor.firstName &&
             formData.value.guarantor.lastName &&
             formData.value.guarantor.email &&
             formData.value.guarantor.relationship
    case 'deposit':
      // If offered, must choose one. If sales pitch, can proceed (interest is optional)
      if (reference.value?.deposit_replacement_offered) {
        return formData.value.deposit.repositConfirmed !== null
      }
      return true // Sales page - can always proceed
    case 'consent':
      return true
    default:
      return false
  }
})

const canSubmit = computed(() => {
  return formData.value.consent.creditCheck &&
         formData.value.consent.amlCheck &&
         formData.value.consent.dataProcessing &&
         formData.value.consent.declaration &&
         formData.value.consent.signature &&
         formData.value.consent.printedName
})

function formatDate(dateStr: string) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function addPreviousAddress() {
  formData.value.residential.previousAddresses.push({
    line1: '',
    line2: '',
    city: '',
    postcode: '',
    years: 0,
    months: 0,
    landlordEmail: ''
  })
}

function removePreviousAddress(index: number) {
  formData.value.residential.previousAddresses.splice(index, 1)
}

function handleFileUploaded(section: string, field: string, data: { fileId: string; url: string }) {
  const sectionData = formData.value[section as keyof typeof formData.value] as any
  if (sectionData) {
    sectionData[field + 'Url'] = data.url
  }
}

function nextStep() {
  if (currentStep.value < totalSteps.value && canProceed.value) {
    saveProgress()
    currentStep.value++
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

function previousStep() {
  if (currentStep.value > 1) {
    currentStep.value--
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

async function saveProgress() {
  const sectionName = steps.value[currentStep.value - 1]?.id
  const sectionData = formData.value[sectionName as keyof typeof formData.value]

  try {
    await fetch(`${API_URL}/api/v2/tenant-form/${token.value}/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section: sectionName, data: sectionData })
    })
  } catch (err) {
    console.error('Failed to save progress:', err)
  }
}

async function handleSubmit() {
  if (!canSubmit.value) return

  submitting.value = true

  try {
    const response = await fetch(`${API_URL}/api/v2/tenant-form/${token.value}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...formData.value,
        // Calculate total annual income for storage
        calculatedAnnualIncome: calculatedAnnualIncome.value
      })
    })

    if (response.ok) {
      submitted.value = true
    } else {
      const data = await response.json()
      error.value = data.error || 'Failed to submit reference'
    }
  } catch (err) {
    console.error('Submit error:', err)
    error.value = 'Failed to submit reference. Please try again.'
  } finally {
    submitting.value = false
  }
}

async function loadReference() {
  try {
    const response = await fetch(`${API_URL}/api/v2/tenant-form/${token.value}`)

    if (!response.ok) {
      error.value = 'This reference link is invalid or has expired.'
      return
    }

    const data = await response.json()
    reference.value = data.reference
    companyName.value = data.companyName
    companyLogo.value = data.companyLogo
    companyPhone.value = data.companyPhone || ''
    companyEmail.value = data.companyEmail || ''
    companyAddress.value = data.companyAddress || ''
    companyWebsite.value = data.companyWebsite || ''
    primaryColor.value = data.primaryColor || '#f97316'
    buttonColor.value = data.buttonColor || '#f97316'

    // Restore saved form data if available
    if (data.reference.form_data) {
      const saved = data.reference.form_data
      // Merge each section, preserving structure
      if (saved.identity) {
        formData.value.identity = { ...formData.value.identity, ...saved.identity }
      }
      if (saved.rtr) {
        formData.value.rtr = { ...formData.value.rtr, ...saved.rtr }
      }
      if (saved.income) {
        formData.value.income = { ...formData.value.income, ...saved.income }
      }
      if (saved.residential) {
        formData.value.residential = { ...formData.value.residential, ...saved.residential }
      }
      if (saved.personal) {
        formData.value.personal = { ...formData.value.personal, ...saved.personal }
      }
      if (saved.guarantor) {
        formData.value.guarantor = { ...formData.value.guarantor, ...saved.guarantor }
      }
      if (saved.deposit) {
        formData.value.deposit = { ...formData.value.deposit, ...saved.deposit }
      }
      if (saved.consent) {
        // Don't restore signature - require fresh signature
        const { signature, ...consentWithoutSig } = saved.consent
        formData.value.consent = { ...formData.value.consent, ...consentWithoutSig }
      }
      console.log('[TenantForm] Restored saved form data')
    } else {
      // Pre-fill name from reference (only if no saved data)
      if (data.reference.tenant_first_name) {
        formData.value.identity.firstName = data.reference.tenant_first_name
      }
      if (data.reference.tenant_last_name) {
        formData.value.identity.lastName = data.reference.tenant_last_name
      }
      // Pre-fill phone if available
      if (data.reference.tenant_phone) {
        formData.value.identity.phone = data.reference.tenant_phone
      }
    }

    // Default Reposit interest to true for sales page (when not offered via offer stage)
    if (!data.reference.deposit_replacement_offered && !data.reference.form_data?.deposit) {
      formData.value.deposit.repositInterested = true
    }

    // Set device gate description
    deviceGateDescription.value = `To complete your tenant reference, ${data.companyName} needs to verify your identity with a photo ID and a live selfie. Switch to your phone with the QR code, or continue here if this device has a working camera.`
  } catch (err) {
    console.error('Load error:', err)
    error.value = 'Failed to load reference. Please try again.'
  } finally {
    loading.value = false
  }
}

// Device handoff gate
function handleDeviceGateProceed() {
  showDeviceGate.value = false
}

const deviceLink = computed(() => {
  if (typeof window !== 'undefined') {
    return window.location.href
  }
  return ''
})

const tenantRequestDetails = computed(() => {
  if (!reference.value) return []
  return [
    { label: 'Property', value: reference.value.property_address },
    { label: 'Monthly Rent', value: reference.value.monthly_rent ? `£${reference.value.monthly_rent}` : null },
    { label: 'Move-in Date', value: reference.value.move_in_date ? formatDate(reference.value.move_in_date) : null }
  ].filter(d => d.value)
})

// Camera capture functions for selfie
async function startCamera() {
  cameraError.value = ''
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false
    })
    cameraStream.value = stream
    showCameraStream.value = true

    await nextTick()

    if (videoElement.value) {
      videoElement.value.srcObject = stream
    }
  } catch (err) {
    console.error('Camera access error:', err)
    if (err instanceof Error) {
      if (err.name === 'NotAllowedError') {
        cameraError.value = 'Camera access denied. Please allow camera access to take a selfie.'
      } else if (err.name === 'NotFoundError') {
        cameraError.value = 'No camera found on this device.'
      } else {
        cameraError.value = 'Unable to access camera. Please try again.'
      }
    }
  }
}

function stopCamera() {
  if (cameraStream.value) {
    cameraStream.value.getTracks().forEach(track => track.stop())
    cameraStream.value = null
  }
  showCameraStream.value = false
  if (videoElement.value) {
    videoElement.value.srcObject = null
  }
}

function capturePhoto() {
  if (!videoElement.value || !canvasElement.value) return

  const video = videoElement.value
  const canvas = canvasElement.value

  canvas.width = video.videoWidth
  canvas.height = video.videoHeight

  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
  }

  canvas.toBlob(async (blob) => {
    if (blob) {
      const timestamp = Date.now()
      const file = new File([blob], `selfie-${timestamp}.jpg`, { type: 'image/jpeg' })
      selfieFile.value = file
      selfiePreview.value = canvas.toDataURL('image/jpeg')
      formData.value.identity.selfie = file

      stopCamera()

      // Auto-upload the selfie
      await uploadSelfie(file)
    }
  }, 'image/jpeg', 0.9)
}

async function uploadSelfie(file: File) {
  selfieUploading.value = true
  try {
    const base64 = await fileToBase64(file)

    const response = await fetch(`${API_URL}/api/v2/tenant-form/${token.value}/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        section: 'identity',
        fileType: file.type,
        fileName: file.name,
        fileData: base64.split(',')[1]
      })
    })

    if (response.ok) {
      const data = await response.json()
      formData.value.identity.selfieUrl = data.url
      selfieUploaded.value = true
    }
  } catch (err) {
    console.error('Selfie upload error:', err)
    cameraError.value = 'Failed to upload selfie. Please try again.'
  } finally {
    selfieUploading.value = false
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
  })
}

function removeSelfie() {
  selfieFile.value = null
  selfiePreview.value = null
  selfieUploaded.value = false
  formData.value.identity.selfie = null
  formData.value.identity.selfieUrl = ''
  stopCamera()
}

onMounted(() => {
  loadReference()
})

onUnmounted(() => {
  stopCamera()
})
</script>
