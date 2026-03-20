<template>
  <div class="min-h-screen bg-gray-50 dark:bg-slate-900 py-8 px-4 sm:px-6 lg:px-8">
    <div class="max-w-2xl mx-auto">
      <!-- Header (hide when showing device gate) -->
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
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Guarantor Reference Form</h1>
        <p class="mt-2 text-gray-600 dark:text-slate-400">
          Complete this form to act as guarantor for {{ tenantName }}'s tenancy
        </p>
      </div>

      <!-- Progress Bar -->
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
          Your guarantor reference has been submitted successfully. {{ companyName }} will be in touch with the next steps.
        </p>
      </div>

      <!-- Device Handoff Gate -->
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
        :request-details="guarantorRequestDetails"
        :link="deviceLink"
        :primary-color="primaryColor"
        :button-color="buttonColor"
        proceed-label="Proceed on this device (Camera required)"
        @proceed="handleDeviceGateProceed"
      />

      <!-- Form -->
      <form v-else-if="reference && !showDeviceGate" @submit.prevent="handleSubmit" novalidate class="space-y-6">
        <!-- Reference Info Banner -->
        <div class="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-4">
          <p class="text-sm text-purple-800 dark:text-purple-300">
            <strong>{{ companyName }}</strong> has requested this guarantor reference for
            <strong>{{ tenantName }}</strong>'s tenancy at <strong>{{ reference.property_address }}</strong>.
            <span v-if="reference.monthly_rent">
              Rent: <strong>£{{ reference.monthly_rent }}/month</strong>
              (Your income must be at least <strong>£{{ requiredAnnualIncome.toLocaleString() }}/year</strong>)
            </span>
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
                <PhoneInput
                  v-model="formData.identity.phone"
                  label="Phone Number"
                  :required="true"
                  select-class="px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary"
                  input-class="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary"
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

            <!-- ID Upload with Email Upload Link option -->
            <div class="space-y-3">
              <FileUpload
                v-if="!formData.identity.idDocumentWillEmail"
                v-model="formData.identity.idDocument"
                label="Upload ID Document"
                :required="!formData.identity.idDocumentWillEmail"
                accept=".pdf,.jpg,.jpeg,.png"
                acceptLabel="PDF, JPG, PNG up to 25MB"
                helpText="Please upload a clear photo or scan of your ID document"
                :uploadUrl="`${API_URL}/api/v2/guarantor-form/${token}/upload`"
                :token="token"
                section="identity"
                @uploaded="handleFileUploaded('identity', 'idDocument', $event)"
              />

              <!-- Email Upload Link Option -->
              <div class="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <input
                  v-model="formData.identity.idDocumentWillEmail"
                  type="checkbox"
                  id="idDocWillEmail"
                  class="w-4 h-4 text-primary rounded"
                />
                <label for="idDocWillEmail" class="text-sm text-blue-800 dark:text-blue-300 flex-1">
                  <Mail class="w-4 h-4 inline mr-1" />
                  Email me an upload link instead
                </label>
                <button
                  v-if="formData.identity.idDocumentWillEmail && !uploadLinksSent.idDocument"
                  type="button"
                  @click="sendUploadLink('identity', 'idDocument', 'ID Document')"
                  :disabled="sendingUploadLink === 'idDocument'"
                  class="px-3 py-1.5 text-xs font-medium text-white rounded-lg flex items-center gap-1"
                  :style="{ backgroundColor: buttonColor }"
                >
                  <Loader2 v-if="sendingUploadLink === 'idDocument'" class="w-3 h-3 animate-spin" />
                  <Send v-else class="w-3 h-3" />
                  Send Link
                </button>
                <span v-else-if="uploadLinksSent.idDocument" class="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                  <CheckCircle class="w-3 h-3" /> Link sent!
                </span>
              </div>
            </div>

            <!-- Selfie/Photo with Camera Capture -->
            <div class="pt-6 border-t border-gray-200 dark:border-slate-700">
              <div class="mb-4">
                <h3 class="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Camera class="w-5 h-5 text-primary" />
                  Identity Photo Verification
                  <span class="text-red-500">*</span>
                </h3>
                <p class="mt-1 text-sm text-gray-600 dark:text-slate-400">
                  We need a clear selfie to match your face to your ID document.
                </p>
              </div>

              <!-- Photo Tips Box -->
              <div v-if="!selfiePreview && !showCameraStream" class="mb-5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                <h4 class="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-3 flex items-center gap-2">
                  <Info class="w-4 h-4" />
                  Tips for the Perfect Photo
                </h4>
                <ul class="space-y-2 text-sm text-blue-700 dark:text-blue-300">
                  <li class="flex items-start gap-2">
                    <CheckCircle class="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-500" />
                    <span><strong>Good lighting</strong> - Face a window or light source</span>
                  </li>
                  <li class="flex items-start gap-2">
                    <CheckCircle class="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-500" />
                    <span><strong>Plain background</strong> - Stand against a light-coloured wall</span>
                  </li>
                  <li class="flex items-start gap-2">
                    <CheckCircle class="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-500" />
                    <span><strong>Face clearly visible</strong> - Remove glasses or hats</span>
                  </li>
                </ul>
              </div>

              <!-- Camera stream view -->
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
                      <div
                        class="w-52 h-72 border-4 border-white/80 rounded-full"
                        style="box-shadow: 0 0 0 9999px rgba(0,0,0,0.5);"
                      ></div>
                      <div class="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-white/80 rounded-full"></div>
                      <div class="absolute -bottom-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-white/80 rounded-full"></div>
                    </div>
                  </div>

                  <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent p-5">
                    <p class="text-white text-sm text-center font-medium">Position your face within the oval</p>
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

              <p v-if="cameraError" class="mt-3 text-sm text-red-600 flex items-center gap-2">
                <AlertCircle class="w-4 h-4" />
                {{ cameraError }}
              </p>
            </div>
          </div>
        </div>

        <!-- ========== SECTION 2: ADDRESS (with proof) ========== -->
        <div v-show="steps[currentStep - 1]?.id === 'address'" class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
          <div class="px-6 py-4 bg-gray-50 dark:bg-slate-700/50 border-b border-gray-200 dark:border-slate-700">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Home class="w-5 h-5 text-primary" />
              Current Address
            </h2>
            <p class="text-sm text-gray-600 dark:text-slate-400 mt-1">Provide your current residential address and proof</p>
          </div>

          <div class="p-6 space-y-5">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Address Line 1 *</label>
              <input
                v-model="formData.address.line1"
                type="text"
                required
                placeholder="Street address"
                class="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Address Line 2</label>
              <input
                v-model="formData.address.line2"
                type="text"
                placeholder="Apartment, suite, etc. (optional)"
                class="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
              />
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">City/Town *</label>
                <input
                  v-model="formData.address.city"
                  type="text"
                  required
                  class="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Postcode *</label>
                <input
                  v-model="formData.address.postcode"
                  type="text"
                  required
                  class="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white uppercase"
                />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Years at Address *</label>
                <input
                  v-model.number="formData.address.years"
                  type="number"
                  min="0"
                  required
                  class="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Months *</label>
                <input
                  v-model.number="formData.address.months"
                  type="number"
                  min="0"
                  max="11"
                  required
                  class="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <!-- Proof of Address -->
            <div class="pt-4 border-t border-gray-200 dark:border-slate-700 space-y-3">
              <FileUpload
                v-if="!formData.address.proofOfAddressWillEmail"
                v-model="formData.address.proofOfAddress"
                label="Proof of Address"
                :required="!formData.address.proofOfAddressWillEmail"
                accept=".pdf,.jpg,.jpeg,.png"
                helpText="Upload a recent utility bill, bank statement, or council tax bill (within last 3 months)"
                :uploadUrl="`${API_URL}/api/v2/guarantor-form/${token}/upload`"
                :token="token"
                section="address"
                @uploaded="handleFileUploaded('address', 'proofOfAddress', $event)"
              />

              <!-- Email Upload Link Option -->
              <div class="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <input
                  v-model="formData.address.proofOfAddressWillEmail"
                  type="checkbox"
                  id="proofAddrWillEmail"
                  class="w-4 h-4 text-primary rounded"
                />
                <label for="proofAddrWillEmail" class="text-sm text-blue-800 dark:text-blue-300 flex-1">
                  <Mail class="w-4 h-4 inline mr-1" />
                  Email me an upload link instead
                </label>
                <button
                  v-if="formData.address.proofOfAddressWillEmail && !uploadLinksSent.proofOfAddress"
                  type="button"
                  @click="sendUploadLink('address', 'proofOfAddress', 'Proof of Address')"
                  :disabled="sendingUploadLink === 'proofOfAddress'"
                  class="px-3 py-1.5 text-xs font-medium text-white rounded-lg flex items-center gap-1"
                  :style="{ backgroundColor: buttonColor }"
                >
                  <Loader2 v-if="sendingUploadLink === 'proofOfAddress'" class="w-3 h-3 animate-spin" />
                  <Send v-else class="w-3 h-3" />
                  Send Link
                </button>
                <span v-else-if="uploadLinksSent.proofOfAddress" class="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                  <CheckCircle class="w-3 h-3" /> Link sent!
                </span>
              </div>
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
            <p class="text-sm text-gray-600 dark:text-slate-400 mt-1">
              As a guarantor, your income must be at least 32x the monthly rent (£{{ requiredAnnualIncome.toLocaleString() }}/year)
            </p>
          </div>

          <div class="p-6 space-y-5">
            <!-- Affordability Check Banner -->
            <div v-if="calculatedAnnualIncome > 0" class="p-4 rounded-lg" :class="isAffordable ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'">
              <div class="flex items-center gap-3">
                <CheckCircle v-if="isAffordable" class="w-6 h-6 text-green-500" />
                <AlertCircle v-else class="w-6 h-6 text-amber-500" />
                <div>
                  <p class="font-medium" :class="isAffordable ? 'text-green-800 dark:text-green-300' : 'text-amber-800 dark:text-amber-300'">
                    Your annual income: £{{ calculatedAnnualIncome.toLocaleString() }}
                  </p>
                  <p class="text-sm" :class="isAffordable ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'">
                    {{ isAffordable ? 'Meets the 32x rent requirement' : `Required: £${requiredAnnualIncome.toLocaleString()} (32x monthly rent)` }}
                  </p>
                </div>
              </div>
            </div>

            <!-- Income Sources (NO student/unemployed for guarantors) -->
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

              <!-- Payslips Upload with Email Option -->
              <div class="space-y-3">
                <FileUpload
                  v-if="!formData.income.payslipsWillEmail"
                  v-model="formData.income.payslips"
                  label="Upload Payslips (Last 3 Months)"
                  accept=".pdf,.jpg,.jpeg,.png"
                  helpText="Upload your most recent 3 payslips to verify income"
                  :uploadUrl="`${API_URL}/api/v2/guarantor-form/${token}/upload`"
                  :token="token"
                  section="income"
                  @uploaded="handleFileUploaded('income', 'payslips', $event)"
                />

                <div class="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <input
                    v-model="formData.income.payslipsWillEmail"
                    type="checkbox"
                    id="payslipsWillEmail"
                    class="w-4 h-4 text-primary rounded"
                  />
                  <label for="payslipsWillEmail" class="text-sm text-blue-800 dark:text-blue-300 flex-1">
                    <Mail class="w-4 h-4 inline mr-1" />
                    Email me an upload link instead
                  </label>
                  <button
                    v-if="formData.income.payslipsWillEmail && !uploadLinksSent.payslips"
                    type="button"
                    @click="sendUploadLink('income', 'payslips', 'Payslips')"
                    :disabled="sendingUploadLink === 'payslips'"
                    class="px-3 py-1.5 text-xs font-medium text-white rounded-lg flex items-center gap-1"
                    :style="{ backgroundColor: buttonColor }"
                  >
                    <Loader2 v-if="sendingUploadLink === 'payslips'" class="w-3 h-3 animate-spin" />
                    <Send v-else class="w-3 h-3" />
                    Send Link
                  </button>
                  <span v-else-if="uploadLinksSent.payslips" class="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                    <CheckCircle class="w-3 h-3" /> Link sent!
                  </span>
                </div>
              </div>
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

              <!-- Tax Return Upload with Email Option -->
              <div class="space-y-3">
                <FileUpload
                  v-if="!formData.income.taxReturnWillEmail"
                  v-model="formData.income.taxReturn"
                  label="Upload Tax Return/SA302"
                  required
                  accept=".pdf,.jpg,.jpeg,.png"
                  helpText="Upload your most recent tax return or SA302"
                  :uploadUrl="`${API_URL}/api/v2/guarantor-form/${token}/upload`"
                  :token="token"
                  section="income"
                  @uploaded="handleFileUploaded('income', 'taxReturn', $event)"
                />

                <div class="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <input
                    v-model="formData.income.taxReturnWillEmail"
                    type="checkbox"
                    id="taxReturnWillEmail"
                    class="w-4 h-4 text-primary rounded"
                  />
                  <label for="taxReturnWillEmail" class="text-sm text-blue-800 dark:text-blue-300 flex-1">
                    <Mail class="w-4 h-4 inline mr-1" />
                    Email me an upload link instead
                  </label>
                  <button
                    v-if="formData.income.taxReturnWillEmail && !uploadLinksSent.taxReturn"
                    type="button"
                    @click="sendUploadLink('income', 'taxReturn', 'Tax Return / SA302')"
                    :disabled="sendingUploadLink === 'taxReturn'"
                    class="px-3 py-1.5 text-xs font-medium text-white rounded-lg flex items-center gap-1"
                    :style="{ backgroundColor: buttonColor }"
                  >
                    <Loader2 v-if="sendingUploadLink === 'taxReturn'" class="w-3 h-3 animate-spin" />
                    <Send v-else class="w-3 h-3" />
                    Send Link
                  </button>
                  <span v-else-if="uploadLinksSent.taxReturn" class="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                    <CheckCircle class="w-3 h-3" /> Link sent!
                  </span>
                </div>
              </div>
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

              <div class="space-y-3">
                <FileUpload
                  v-if="!formData.income.savingsDocWillEmail"
                  v-model="formData.income.savingsDoc"
                  label="Upload Proof of Savings"
                  required
                  accept=".pdf,.jpg,.jpeg,.png"
                  helpText="Upload bank or investment statement showing your savings"
                  :uploadUrl="`${API_URL}/api/v2/guarantor-form/${token}/upload`"
                  :token="token"
                  section="income"
                  @uploaded="handleFileUploaded('income', 'savingsDoc', $event)"
                />

                <div class="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <input
                    v-model="formData.income.savingsDocWillEmail"
                    type="checkbox"
                    id="savingsDocWillEmail"
                    class="w-4 h-4 text-primary rounded"
                  />
                  <label for="savingsDocWillEmail" class="text-sm text-blue-800 dark:text-blue-300 flex-1">
                    <Mail class="w-4 h-4 inline mr-1" />
                    Email me an upload link instead
                  </label>
                  <button
                    v-if="formData.income.savingsDocWillEmail && !uploadLinksSent.savingsDoc"
                    type="button"
                    @click="sendUploadLink('income', 'savingsDoc', 'Proof of Savings')"
                    :disabled="sendingUploadLink === 'savingsDoc'"
                    class="px-3 py-1.5 text-xs font-medium text-white rounded-lg flex items-center gap-1"
                    :style="{ backgroundColor: buttonColor }"
                  >
                    <Loader2 v-if="sendingUploadLink === 'savingsDoc'" class="w-3 h-3 animate-spin" />
                    <Send v-else class="w-3 h-3" />
                    Send Link
                  </button>
                  <span v-else-if="uploadLinksSent.savingsDoc" class="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                    <CheckCircle class="w-3 h-3" /> Link sent!
                  </span>
                </div>
              </div>
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

              <div class="space-y-3">
                <FileUpload
                  v-if="!formData.income.pensionDocWillEmail"
                  v-model="formData.income.pensionDoc"
                  label="Upload Pension Statement"
                  required
                  accept=".pdf,.jpg,.jpeg,.png"
                  :uploadUrl="`${API_URL}/api/v2/guarantor-form/${token}/upload`"
                  :token="token"
                  section="income"
                  @uploaded="handleFileUploaded('income', 'pensionDoc', $event)"
                />

                <div class="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <input
                    v-model="formData.income.pensionDocWillEmail"
                    type="checkbox"
                    id="pensionDocWillEmail"
                    class="w-4 h-4 text-primary rounded"
                  />
                  <label for="pensionDocWillEmail" class="text-sm text-blue-800 dark:text-blue-300 flex-1">
                    <Mail class="w-4 h-4 inline mr-1" />
                    Email me an upload link instead
                  </label>
                  <button
                    v-if="formData.income.pensionDocWillEmail && !uploadLinksSent.pensionDoc"
                    type="button"
                    @click="sendUploadLink('income', 'pensionDoc', 'Pension Statement')"
                    :disabled="sendingUploadLink === 'pensionDoc'"
                    class="px-3 py-1.5 text-xs font-medium text-white rounded-lg flex items-center gap-1"
                    :style="{ backgroundColor: buttonColor }"
                  >
                    <Loader2 v-if="sendingUploadLink === 'pensionDoc'" class="w-3 h-3 animate-spin" />
                    <Send v-else class="w-3 h-3" />
                    Send Link
                  </button>
                  <span v-else-if="uploadLinksSent.pensionDoc" class="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                    <CheckCircle class="w-3 h-3" /> Link sent!
                  </span>
                </div>
              </div>
            </div>

            <!-- Landlord/Rental Income -->
            <div v-if="formData.income.sources.includes('landlord_rental')" class="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg space-y-4">
              <h3 class="font-medium text-gray-900 dark:text-white">Landlord/Rental Income</h3>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Annual Rental Income (£) *</label>
                <input
                  v-model.number="formData.income.rentalIncome"
                  type="number"
                  min="0"
                  required
                  class="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                />
              </div>

              <div class="space-y-3">
                <FileUpload
                  v-if="!formData.income.rentalDocWillEmail"
                  v-model="formData.income.rentalDoc"
                  label="Upload Proof of Rental Income"
                  required
                  accept=".pdf,.jpg,.jpeg,.png"
                  helpText="Upload bank statements showing rental income or tenancy agreements"
                  :uploadUrl="`${API_URL}/api/v2/guarantor-form/${token}/upload`"
                  :token="token"
                  section="income"
                  @uploaded="handleFileUploaded('income', 'rentalDoc', $event)"
                />

                <div class="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <input
                    v-model="formData.income.rentalDocWillEmail"
                    type="checkbox"
                    id="rentalDocWillEmail"
                    class="w-4 h-4 text-primary rounded"
                  />
                  <label for="rentalDocWillEmail" class="text-sm text-blue-800 dark:text-blue-300 flex-1">
                    <Mail class="w-4 h-4 inline mr-1" />
                    Email me an upload link instead
                  </label>
                  <button
                    v-if="formData.income.rentalDocWillEmail && !uploadLinksSent.rentalDoc"
                    type="button"
                    @click="sendUploadLink('income', 'rentalDoc', 'Rental Income Proof')"
                    :disabled="sendingUploadLink === 'rentalDoc'"
                    class="px-3 py-1.5 text-xs font-medium text-white rounded-lg flex items-center gap-1"
                    :style="{ backgroundColor: buttonColor }"
                  >
                    <Loader2 v-if="sendingUploadLink === 'rentalDoc'" class="w-3 h-3 animate-spin" />
                    <Send v-else class="w-3 h-3" />
                    Send Link
                  </button>
                  <span v-else-if="uploadLinksSent.rentalDoc" class="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                    <CheckCircle class="w-3 h-3" /> Link sent!
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ========== SECTION 4: CONSENT & SIGNATURE ========== -->
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
                <li>I authorize the referees I have provided (employers, accountants) to be contacted.</li>
                <li>I understand that providing false information may result in the tenancy application being rejected.</li>
                <li>I consent to my personal data being processed for the purpose of this guarantor reference in accordance with GDPR.</li>
                <li><strong>I agree to act as guarantor for the tenant named above and accept the financial responsibilities this entails.</strong></li>
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
                  I agree to the processing of my personal data for guarantor referencing purposes *
                </span>
              </label>

              <label class="flex items-start gap-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg cursor-pointer border border-purple-200 dark:border-purple-800">
                <input v-model="formData.consent.guarantorAgreement" type="checkbox" class="mt-1 w-4 h-4 text-primary rounded" />
                <span class="text-sm text-purple-800 dark:text-purple-300">
                  <strong>I agree to act as guarantor</strong> and accept responsibility for any rent arrears or damages if the tenant fails to meet their obligations *
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
            <span v-else>Submit Guarantor Reference</span>
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
  Loader2, CheckCircle, AlertCircle, User, Home, Briefcase,
  FileSignature, ChevronLeft, ChevronRight, Camera, Mail, Send, Info
} from 'lucide-vue-next'
import FileUpload from '@/components/forms/FileUpload.vue'
import SignaturePad from '@/components/forms/SignaturePad.vue'
import DeviceHandoffGate from '@/components/DeviceHandoffGate.vue'
import PhoneInput from '@/components/PhoneInput.vue'

const API_URL = import.meta.env.VITE_API_URL ?? ''
const route = useRoute()
const token = computed(() => route.params.token as string)

const loading = ref(true)
const error = ref('')
const submitting = ref(false)
const submitted = ref(false)

const reference = ref<any>(null)
const tenantName = ref('')
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
const deviceGateTitle = ref('Complete Your Guarantor Reference')
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

// Upload link tracking
const sendingUploadLink = ref<string | null>(null)
const uploadLinksSent = ref<Record<string, boolean>>({})

const currentStep = ref(1)

// Guarantor-specific income sources (NO student/unemployed)
const incomeSourceOptions = [
  { value: 'employed', label: 'Employed' },
  { value: 'self_employed', label: 'Self-Employed' },
  { value: 'pension', label: 'Pension' },
  { value: 'savings', label: 'Savings' },
  { value: 'landlord_rental', label: 'Landlord/Rental Income' }
]

// 4 steps for guarantors: Identity, Address, Income, Consent
const steps = [
  { id: 'identity', label: 'Identity' },
  { id: 'address', label: 'Address' },
  { id: 'income', label: 'Income' },
  { id: 'consent', label: 'Consent' }
]

const totalSteps = computed(() => steps.length)

const formData = ref({
  identity: {
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    phone: '',
    documentType: '',
    idDocument: null as File | null,
    idDocumentUrl: '',
    idDocumentWillEmail: false,
    selfie: null as File | null,
    selfieUrl: ''
  },
  address: {
    line1: '',
    line2: '',
    city: '',
    postcode: '',
    years: 0,
    months: 0,
    proofOfAddress: null as File | null,
    proofOfAddressUrl: '',
    proofOfAddressWillEmail: false
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
    payslipsWillEmail: false,
    // Self-employed
    businessName: '',
    businessNature: '',
    businessStartDate: '',
    selfEmployedIncome: null as number | null,
    accountantName: '',
    accountantEmail: '',
    taxReturn: null as File | null,
    taxReturnUrl: '',
    taxReturnWillEmail: false,
    // Savings
    savingsAmount: null as number | null,
    savingsDoc: null as File | null,
    savingsDocUrl: '',
    savingsDocWillEmail: false,
    // Pension
    pensionAmount: null as number | null,
    pensionProvider: '',
    pensionDoc: null as File | null,
    pensionDocUrl: '',
    pensionDocWillEmail: false,
    // Landlord/Rental
    rentalIncome: null as number | null,
    rentalDoc: null as File | null,
    rentalDocUrl: '',
    rentalDocWillEmail: false
  },
  consent: {
    creditCheck: false,
    amlCheck: false,
    dataProcessing: false,
    guarantorAgreement: false,
    declaration: false,
    signature: null as string | null,
    printedName: ''
  }
})

// 32x rent requirement for guarantors
const requiredAnnualIncome = computed(() => {
  if (!reference.value?.monthly_rent) return 0
  return reference.value.monthly_rent * 32
})

const calculatedAnnualIncome = computed(() => {
  let total = 0

  if (formData.value.income.sources.includes('employed') && formData.value.income.annualSalary) {
    total += formData.value.income.annualSalary
  }
  if (formData.value.income.sources.includes('self_employed') && formData.value.income.selfEmployedIncome) {
    total += formData.value.income.selfEmployedIncome
  }
  if (formData.value.income.sources.includes('pension') && formData.value.income.pensionAmount) {
    total += formData.value.income.pensionAmount * 12
  }
  if (formData.value.income.sources.includes('landlord_rental') && formData.value.income.rentalIncome) {
    total += formData.value.income.rentalIncome
  }

  return total
})

const isAffordable = computed(() => {
  return calculatedAnnualIncome.value >= requiredAnnualIncome.value
})

const canProceed = computed(() => {
  const currentStepId = steps[currentStep.value - 1]?.id

  switch (currentStepId) {
    case 'identity':
      return formData.value.identity.firstName &&
             formData.value.identity.lastName &&
             formData.value.identity.dateOfBirth &&
             formData.value.identity.documentType &&
             (selfieUploaded.value || formData.value.identity.selfieUrl)
    case 'address':
      return formData.value.address.line1 &&
             formData.value.address.city &&
             formData.value.address.postcode
    case 'income':
      return formData.value.income.sources.length > 0
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
         formData.value.consent.guarantorAgreement &&
         formData.value.consent.declaration &&
         formData.value.consent.signature &&
         formData.value.consent.printedName
})

function formatDate(dateStr: string) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function handleFileUploaded(section: string, field: string, data: { fileId: string; url: string }) {
  const sectionData = formData.value[section as keyof typeof formData.value] as any
  if (sectionData) {
    sectionData[field + 'Url'] = data.url
  }
}

async function sendUploadLink(section: string, field: string, documentName: string) {
  sendingUploadLink.value = field
  try {
    const response = await fetch(`${API_URL}/api/v2/guarantor-form/${token.value}/send-upload-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        section,
        field,
        documentName,
        email: reference.value?.tenant_email || formData.value.identity.phone // Use email on file
      })
    })

    if (response.ok) {
      uploadLinksSent.value[field] = true
    } else {
      console.error('Failed to send upload link')
    }
  } catch (err) {
    console.error('Error sending upload link:', err)
  } finally {
    sendingUploadLink.value = null
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
  const sectionName = steps[currentStep.value - 1]?.id
  const sectionData = formData.value[sectionName as keyof typeof formData.value]

  try {
    await fetch(`${API_URL}/api/v2/guarantor-form/${token.value}/save`, {
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
    const response = await fetch(`${API_URL}/api/v2/guarantor-form/${token.value}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...formData.value,
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
    const response = await fetch(`${API_URL}/api/v2/guarantor-form/${token.value}`)

    if (!response.ok) {
      error.value = 'This reference link is invalid or has expired.'
      return
    }

    const data = await response.json()
    reference.value = data.reference
    tenantName.value = data.tenantName || 'the tenant'
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
      if (saved.identity) {
        formData.value.identity = { ...formData.value.identity, ...saved.identity }
      }
      if (saved.address) {
        formData.value.address = { ...formData.value.address, ...saved.address }
      }
      if (saved.income) {
        formData.value.income = { ...formData.value.income, ...saved.income }
      }
      if (saved.consent) {
        const { signature, ...consentWithoutSig } = saved.consent
        formData.value.consent = { ...formData.value.consent, ...consentWithoutSig }
      }
    } else {
      // Pre-fill name from reference
      if (data.reference.tenant_first_name) {
        formData.value.identity.firstName = data.reference.tenant_first_name
      }
      if (data.reference.tenant_last_name) {
        formData.value.identity.lastName = data.reference.tenant_last_name
      }
    }

    deviceGateDescription.value = `To complete your guarantor reference for ${tenantName.value}, ${data.companyName} needs to verify your identity with a photo ID and a live selfie.`
  } catch (err) {
    console.error('Load error:', err)
    error.value = 'Failed to load reference. Please try again.'
  } finally {
    loading.value = false
  }
}

function handleDeviceGateProceed() {
  showDeviceGate.value = false
}

const deviceLink = computed(() => {
  if (typeof window !== 'undefined') {
    return window.location.href
  }
  return ''
})

const guarantorRequestDetails = computed(() => {
  if (!reference.value) return []
  return [
    { label: 'Property', value: reference.value.property_address },
    { label: 'Tenant', value: tenantName.value },
    { label: 'Monthly Rent', value: reference.value.monthly_rent ? `£${reference.value.monthly_rent}` : null }
  ].filter(d => d.value)
})

// Camera capture functions
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

      await uploadSelfie(file)
    }
  }, 'image/jpeg', 0.9)
}

async function uploadSelfie(file: File) {
  selfieUploading.value = true
  try {
    const base64 = await fileToBase64(file)

    const response = await fetch(`${API_URL}/api/v2/guarantor-form/${token.value}/upload`, {
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
