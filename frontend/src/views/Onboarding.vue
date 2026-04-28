<template>
  <div class="min-h-screen bg-gradient-to-br from-orange-50 to-white dark:from-slate-900 dark:to-slate-800 flex flex-col">
    <!-- Progress Bar (top) -->
    <div v-if="currentStepIndex > 0" class="fixed top-0 left-0 right-0 z-50">
      <div class="w-full bg-gray-200 dark:bg-slate-700 h-1">
        <div
          class="bg-primary h-1 transition-all duration-500 ease-out"
          :style="{ width: progressPercentage + '%' }"
        ></div>
      </div>
    </div>

    <!-- Header -->
    <div v-if="currentStepIndex > 0" class="flex items-center justify-between px-6 py-4">
      <button
        v-if="canGoBack"
        @click="goBack"
        class="flex items-center gap-2 text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white transition-colors"
      >
        <ArrowLeft class="w-5 h-5" />
        <span class="text-sm">Back</span>
      </button>
      <div v-else></div>
      <span class="text-sm text-gray-400 dark:text-slate-500">{{ currentStepIndex }} / {{ totalSteps }}</span>
    </div>

    <!-- Main Content -->
    <div class="flex-1 flex items-center justify-center px-4 py-8">
      <div class="w-full max-w-2xl">
        <TransitionGroup
          :name="transitionDirection"
          tag="div"
          class="relative"
        >
          <!-- ==================== WELCOME ==================== -->
          <div v-if="currentStep === 'welcome'" key="welcome" class="text-center space-y-8">
            <div>
              <img src="/PropertyGooseLogoFull.png" alt="PropertyGoose" class="h-56 mx-auto mb-6" />
              <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-4">Welcome, landlord</h1>
              <p class="text-lg text-gray-600 dark:text-slate-400 max-w-lg mx-auto">
                Let's get you set up to manage your properties, run tenant references, and create agreements.
              </p>
            </div>
            <p class="text-sm text-gray-500 dark:text-slate-500">Takes about 5 minutes</p>
            <button
              @click="goNext"
              class="px-10 py-4 bg-primary text-white text-lg font-medium rounded-lg hover:bg-primary/90 transition-all shadow-lg hover:shadow-xl"
            >
              Get Started
            </button>
          </div>

          <!-- ==================== TITLE ==================== -->
          <div v-else-if="currentStep === 'title'" key="title" class="space-y-6">
            <div>
              <p class="text-sm font-medium text-primary mb-2">1 &rarr;</p>
              <h2 class="text-3xl font-bold text-gray-900 dark:text-white">What's your title?</h2>
            </div>
            <div class="flex flex-wrap gap-3">
              <button
                v-for="t in ['Mr', 'Mrs', 'Ms', 'Miss', 'Dr']"
                :key="t"
                @click="landlord.title = t; goNext()"
                class="px-6 py-3 rounded-lg border-2 text-lg font-medium transition-all"
                :class="landlord.title === t
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 hover:border-primary/50'"
              >
                {{ t }}
              </button>
            </div>
          </div>

          <!-- ==================== FIRST NAME ==================== -->
          <div v-else-if="currentStep === 'firstName'" key="firstName" class="space-y-6">
            <div>
              <p class="text-sm font-medium text-primary mb-2">2 &rarr;</p>
              <h2 class="text-3xl font-bold text-gray-900 dark:text-white">What's your first name? <span class="text-red-500">*</span></h2>
            </div>
            <div class="relative">
              <input
                ref="activeInput"
                v-model="landlord.firstName"
                type="text"
                placeholder="Type your first name..."
                class="typeform-input"
                @keydown.enter.prevent="validateAndNext"
              />
              <EnterHint :show="!!landlord.firstName" />
            </div>
            <p v-if="fieldError" class="text-red-500 text-sm">{{ fieldError }}</p>
          </div>

          <!-- ==================== LAST NAME ==================== -->
          <div v-else-if="currentStep === 'lastName'" key="lastName" class="space-y-6">
            <div>
              <p class="text-sm font-medium text-primary mb-2">3 &rarr;</p>
              <h2 class="text-3xl font-bold text-gray-900 dark:text-white">And your last name? <span class="text-red-500">*</span></h2>
            </div>
            <div class="relative">
              <input
                ref="activeInput"
                v-model="landlord.lastName"
                type="text"
                placeholder="Type your last name..."
                class="typeform-input"
                @keydown.enter.prevent="validateAndNext"
              />
              <EnterHint :show="!!landlord.lastName" />
            </div>
            <p v-if="fieldError" class="text-red-500 text-sm">{{ fieldError }}</p>
          </div>

          <!-- ==================== MIDDLE NAME ==================== -->
          <div v-else-if="currentStep === 'middleName'" key="middleName" class="space-y-6">
            <div>
              <p class="text-sm font-medium text-primary mb-2">4 &rarr;</p>
              <h2 class="text-3xl font-bold text-gray-900 dark:text-white">Do you have a middle name?</h2>
              <p class="text-gray-500 dark:text-slate-400 mt-1">Optional — leave blank to skip</p>
            </div>
            <div class="relative">
              <input
                ref="activeInput"
                v-model="landlord.middleName"
                type="text"
                placeholder="Type your middle name..."
                class="typeform-input"
                @keydown.enter.prevent="goNext"
              />
              <EnterHint :show="true" :label="landlord.middleName ? 'Enter ↵' : 'Enter to skip'" />
            </div>
          </div>

          <!-- ==================== DATE OF BIRTH ==================== -->
          <div v-else-if="currentStep === 'dateOfBirth'" key="dateOfBirth" class="space-y-6">
            <div>
              <p class="text-sm font-medium text-primary mb-2">5 &rarr;</p>
              <h2 class="text-3xl font-bold text-gray-900 dark:text-white">What's your date of birth? <span class="text-red-500">*</span></h2>
              <p class="text-gray-500 dark:text-slate-400 mt-1">Required for identity verification under UK AML regulations</p>
            </div>
            <div class="flex items-center gap-3">
              <div class="flex-1">
                <label class="block text-xs text-gray-400 mb-1">Day</label>
                <input
                  ref="activeInput"
                  v-model="dobDay"
                  type="text"
                  inputmode="numeric"
                  maxlength="2"
                  placeholder="DD"
                  class="typeform-input text-center"
                  @input="handleDobDay"
                  @keydown.enter.prevent="validateAndNext"
                />
              </div>
              <span class="text-3xl text-gray-300 dark:text-slate-600 mt-5">/</span>
              <div class="flex-1">
                <label class="block text-xs text-gray-400 mb-1">Month</label>
                <input
                  ref="dobMonthInput"
                  v-model="dobMonth"
                  type="text"
                  inputmode="numeric"
                  maxlength="2"
                  placeholder="MM"
                  class="typeform-input text-center"
                  @input="handleDobMonth"
                  @keydown.enter.prevent="validateAndNext"
                />
              </div>
              <span class="text-3xl text-gray-300 dark:text-slate-600 mt-5">/</span>
              <div class="flex-[1.5]">
                <label class="block text-xs text-gray-400 mb-1">Year</label>
                <input
                  ref="dobYearInput"
                  v-model="dobYear"
                  type="text"
                  inputmode="numeric"
                  maxlength="4"
                  placeholder="YYYY"
                  class="typeform-input text-center"
                  @input="handleDobYear"
                  @keydown.enter.prevent="validateAndNext"
                />
              </div>
            </div>
            <p v-if="fieldError" class="text-red-500 text-sm">{{ fieldError }}</p>
            <OkButton @click="validateAndNext" />
          </div>

          <!-- ==================== PHONE ==================== -->
          <div v-else-if="currentStep === 'phone'" key="phone" class="space-y-6">
            <div>
              <p class="text-sm font-medium text-primary mb-2">6 &rarr;</p>
              <h2 class="text-3xl font-bold text-gray-900 dark:text-white">What's your phone number? <span class="text-red-500">*</span></h2>
              <p class="text-gray-500 dark:text-slate-400 mt-1">For important account and property notifications</p>
            </div>
            <input
              ref="activeInput"
              v-model="landlord.phone"
              type="tel"
              placeholder="07123 456789"
              class="typeform-input"
              @keydown.enter.prevent="validateAndNext"
            />
            <p v-if="fieldError" class="text-red-500 text-sm">{{ fieldError }}</p>
            <OkButton @click="validateAndNext" />
          </div>

          <!-- ==================== CONTRACT NAME ==================== -->
          <div v-else-if="currentStep === 'contractName'" key="contractName" class="space-y-6">
            <div>
              <p class="text-sm font-medium text-primary mb-2">7 &rarr;</p>
              <h2 class="text-3xl font-bold text-gray-900 dark:text-white">How should your name appear on contracts? <span class="text-red-500">*</span></h2>
              <p class="text-gray-500 dark:text-slate-400 mt-1">This is the name displayed on tenancy agreements</p>
            </div>
            <input
              ref="activeInput"
              v-model="landlord.contractName"
              type="text"
              :placeholder="defaultContractName"
              class="typeform-input"
              @keydown.enter.prevent="validateAndNext"
            />
            <p v-if="fieldError" class="text-red-500 text-sm">{{ fieldError }}</p>
            <OkButton @click="validateAndNext" />
          </div>

          <!-- ==================== EMAIL GREETING ==================== -->
          <div v-else-if="currentStep === 'emailGreeting'" key="emailGreeting" class="space-y-6">
            <div>
              <p class="text-sm font-medium text-primary mb-2">8 &rarr;</p>
              <h2 class="text-3xl font-bold text-gray-900 dark:text-white">How should we greet you in emails?</h2>
              <p class="text-gray-500 dark:text-slate-400 mt-1">We'll use this in our email communications to you</p>
            </div>
            <input
              ref="activeInput"
              v-model="landlord.emailGreeting"
              type="text"
              :placeholder="landlord.firstName || 'e.g. John'"
              class="typeform-input"
              @keydown.enter.prevent="goNext"
            />
            <OkButton @click="goNext" />
          </div>

          <!-- ==================== ADDRESS ==================== -->
          <div v-else-if="currentStep === 'address'" key="address" class="space-y-6">
            <div>
              <p class="text-sm font-medium text-primary mb-2">9 &rarr;</p>
              <h2 class="text-3xl font-bold text-gray-900 dark:text-white">What's your home address? <span class="text-red-500">*</span></h2>
              <p class="text-gray-500 dark:text-slate-400 mt-1">Your residential address for correspondence and agreements</p>
            </div>

            <!-- Search input (always visible) -->
            <AddressAutocomplete
              ref="addressAutocomplete"
              v-model="addressSearch"
              placeholder="Start typing your address..."
              id="landlord-address"
              class="typeform-address-wrap"
              @address-selected="handleAddressSelected"
            />

            <!-- Filled address confirmation (appears after selection) -->
            <Transition name="fade">
              <div v-if="landlord.addressLine1 && landlord.city && landlord.postcode" class="space-y-3">
                <div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-5">
                  <div class="flex items-start justify-between">
                    <div class="space-y-0.5">
                      <p class="text-base font-medium text-gray-900 dark:text-white">{{ landlord.addressLine1 }}</p>
                      <p v-if="landlord.addressLine2" class="text-sm text-gray-600 dark:text-slate-400">{{ landlord.addressLine2 }}</p>
                      <p class="text-sm text-gray-600 dark:text-slate-400">{{ landlord.city }}, {{ landlord.postcode }}</p>
                    </div>
                    <button @click="clearAddress" class="text-xs text-gray-400 hover:text-red-500 underline flex-shrink-0 ml-4">Change</button>
                  </div>
                </div>
                <div class="flex justify-end">
                  <button
                    @click="validateAndNext"
                    class="text-xs text-gray-400 dark:text-slate-500 flex items-center gap-1.5 hover:text-gray-600 transition-colors"
                  >
                    press <kbd class="px-1.5 py-0.5 bg-gray-100 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded text-[10px] font-mono font-semibold text-gray-500 dark:text-slate-400">Enter &#8629;</kbd>
                  </button>
                </div>
              </div>
            </Transition>

            <p v-if="fieldError" class="text-red-500 text-sm">{{ fieldError }}</p>
          </div>

          <!-- ==================== AML VERIFICATION ==================== -->
          <div v-else-if="currentStep === 'aml'" key="aml" class="space-y-6">
            <div>
              <p class="text-sm font-medium text-primary mb-2">10 &rarr;</p>
              <h2 class="text-3xl font-bold text-gray-900 dark:text-white">Identity Verification</h2>
              <p class="text-gray-500 dark:text-slate-400 mt-1">
                UK AML regulations require us to verify your identity. Upload a photo of your ID and take a selfie.
              </p>
            </div>

            <!-- ID Document Type -->
            <div class="space-y-2">
              <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">ID Document Type <span class="text-red-500">*</span></label>
              <div class="flex flex-wrap gap-3">
                <button
                  v-for="dt in idDocTypes"
                  :key="dt.value"
                  @click="landlord.idDocumentType = dt.value"
                  class="px-5 py-2.5 rounded-lg border-2 text-sm font-medium transition-all"
                  :class="landlord.idDocumentType === dt.value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 hover:border-primary/50'"
                >
                  {{ dt.label }}
                </button>
              </div>
            </div>

            <!-- ID Document Upload -->
            <div class="space-y-2">
              <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">
                ID Document Photo <span class="text-red-500">*</span>
              </label>

              <!-- Uploaded state -->
              <div v-if="aml.idDocUrl || landlord.idDocument" class="border-2 border-green-400 bg-green-50 dark:bg-green-900/20 rounded-lg p-4 sm:p-6 text-center">
                <CheckCircle class="w-8 h-8 text-green-500 mx-auto mb-2" />
                <p class="text-sm text-green-700 dark:text-green-300">{{ landlord.idDocument?.name || 'ID document uploaded' }}</p>
                <button @click="landlord.idDocument = null; aml.idDocUrl = ''; aml.idDocFile = null" class="text-xs text-red-500 hover:text-red-700 mt-1 underline">Remove</button>
              </div>

              <!-- ID camera active -->
              <div v-else-if="aml.idCameraActive" class="space-y-3">
                <div class="relative bg-black rounded-xl overflow-hidden" style="max-width: 480px; margin: 0 auto;">
                  <video ref="idVideo" autoplay playsinline class="w-full h-auto"></video>
                  <canvas ref="idCanvas" class="hidden"></canvas>
                  <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                    <p class="text-white text-sm text-center font-medium">Position your ID document in frame</p>
                  </div>
                </div>
                <div class="flex gap-3">
                  <button @click="captureIdPhoto" class="flex-1 px-6 py-3 bg-primary text-white rounded-lg font-medium flex items-center justify-center gap-2">
                    <Camera class="w-4 h-4" /> Capture
                  </button>
                  <button @click="stopIdCamera" class="px-4 py-3 bg-gray-100 dark:bg-slate-700 rounded-lg text-gray-700 dark:text-slate-300 font-medium">Cancel</button>
                </div>
              </div>

              <!-- ID photo preview -->
              <div v-else-if="aml.idDocPreview" class="space-y-3">
                <div class="flex justify-center">
                  <img :src="aml.idDocPreview" alt="ID Preview" class="max-h-48 object-contain rounded-xl border-2 border-gray-300" />
                </div>
                <div class="flex gap-3">
                  <button @click="confirmIdCapture" class="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-medium flex items-center justify-center gap-2">
                    <CheckCircle class="w-4 h-4" /> Use this photo
                  </button>
                  <button @click="aml.idDocPreview = ''; aml.idDocBlob = null" class="px-4 py-3 bg-gray-100 dark:bg-slate-700 rounded-lg text-gray-700 dark:text-slate-300 font-medium">Retake</button>
                </div>
              </div>

              <!-- Options -->
              <div v-else class="space-y-3">
                <button
                  @click="startIdCamera"
                  class="w-full px-4 sm:px-6 py-3 sm:py-4 rounded-lg border-2 border-gray-300 dark:border-slate-600 hover:border-primary transition-all flex items-center gap-3 group"
                >
                  <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Camera class="w-5 h-5 text-primary" />
                  </div>
                  <div class="text-left">
                    <p class="font-medium text-gray-900 dark:text-white group-hover:text-primary text-sm sm:text-base">Take photo of your ID</p>
                    <p class="text-xs text-gray-500 dark:text-slate-400">Use your camera to photograph your document</p>
                  </div>
                </button>

                <button
                  @click="startMobileCapture('id_document')"
                  class="w-full px-4 sm:px-6 py-3 sm:py-4 rounded-lg border-2 border-gray-300 dark:border-slate-600 hover:border-primary transition-all flex items-center gap-3 group"
                >
                  <div class="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                    <Smartphone class="w-5 h-5 text-blue-600" />
                  </div>
                  <div class="text-left">
                    <p class="font-medium text-gray-900 dark:text-white group-hover:text-primary text-sm sm:text-base">Take photo on your phone</p>
                    <p class="text-xs text-gray-500 dark:text-slate-400">Scan a QR code to use your phone's camera</p>
                  </div>
                </button>

                <button
                  @click="($refs.idDocInput as HTMLInputElement).click()"
                  class="w-full px-4 sm:px-6 py-3 sm:py-4 rounded-lg border-2 border-gray-300 dark:border-slate-600 hover:border-primary transition-all flex items-center gap-3 group"
                >
                  <div class="w-10 h-10 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                    <Upload class="w-5 h-5 text-gray-600 dark:text-slate-400" />
                  </div>
                  <div class="text-left">
                    <p class="font-medium text-gray-900 dark:text-white group-hover:text-primary text-sm sm:text-base">Upload a file</p>
                    <p class="text-xs text-gray-500 dark:text-slate-400">JPG, PNG, or PDF — max 10MB</p>
                  </div>
                </button>
              </div>
              <input ref="idDocInput" type="file" class="hidden" accept="image/*,.pdf" @change="handleIdDocUpload" />
            </div>

            <!-- Selfie Section -->
            <div class="space-y-2">
              <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">
                Selfie <span class="text-red-500">*</span>
              </label>
              <p class="text-xs text-gray-500 dark:text-slate-400">A clear photo of your face — we'll match this to your ID</p>

              <!-- Selfie uploaded state -->
              <div v-if="aml.selfieUrl || landlord.selfie" class="border-2 border-green-400 bg-green-50 dark:bg-green-900/20 rounded-lg p-6 text-center">
                <div v-if="aml.selfiePreview" class="mb-3">
                  <img :src="aml.selfiePreview" alt="Selfie" class="w-24 h-24 object-cover rounded-full mx-auto border-2 border-green-400" />
                </div>
                <CheckCircle v-else class="w-8 h-8 text-green-500 mx-auto mb-2" />
                <p class="text-sm text-green-700 dark:text-green-300">Selfie captured</p>
                <button @click="resetSelfie" class="text-xs text-red-500 hover:text-red-700 mt-1 underline">Retake</button>
              </div>

              <!-- Camera / QR options -->
              <div v-else class="space-y-3">
                <!-- Live camera (if active) -->
                <div v-if="aml.cameraActive" class="space-y-3">
                  <div class="relative bg-black rounded-xl overflow-hidden" style="max-width: 480px; margin: 0 auto;">
                    <video ref="amlVideo" autoplay playsinline class="w-full h-auto" style="transform: scaleX(-1);"></video>
                    <canvas ref="amlCanvas" class="hidden"></canvas>
                    <!-- Oval guide -->
                    <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div class="w-44 h-60 border-4 border-white/70 rounded-full" style="box-shadow: 0 0 0 9999px rgba(0,0,0,0.5);"></div>
                    </div>
                    <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                      <p class="text-white text-sm text-center font-medium">Position your face within the oval</p>
                    </div>
                  </div>
                  <div class="flex gap-3">
                    <button @click="captureSelfie" class="flex-1 px-6 py-2.5 bg-primary text-white rounded-lg font-medium flex items-center justify-center gap-2">
                      <Camera class="w-4 h-4" /> Capture
                    </button>
                    <button @click="stopAmlCamera" class="px-4 py-2.5 bg-gray-100 dark:bg-slate-700 rounded-lg text-gray-700 dark:text-slate-300 font-medium">Cancel</button>
                  </div>
                </div>

                <!-- Selfie preview (before confirm) -->
                <div v-else-if="aml.selfiePreview && !aml.selfieUrl && !landlord.selfie" class="space-y-3">
                  <div class="flex justify-center">
                    <img :src="aml.selfiePreview" alt="Preview" class="w-40 h-48 object-cover rounded-xl border-2 border-gray-300" />
                  </div>
                  <div class="flex gap-3">
                    <button @click="confirmSelfieCapture" class="flex-1 px-6 py-2.5 bg-green-600 text-white rounded-lg font-medium flex items-center justify-center gap-2">
                      <CheckCircle class="w-4 h-4" /> Use this photo
                    </button>
                    <button @click="resetSelfie" class="px-4 py-2.5 bg-gray-100 dark:bg-slate-700 rounded-lg text-gray-700 dark:text-slate-300 font-medium">Retake</button>
                  </div>
                </div>

                <!-- Action buttons (no camera active, no preview) -->
                <div v-else class="space-y-3">
                  <button
                    @click="startAmlCamera"
                    class="w-full px-6 py-4 rounded-lg border-2 border-gray-300 dark:border-slate-600 hover:border-primary transition-all flex items-center gap-3 group"
                  >
                    <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Camera class="w-5 h-5 text-primary" />
                    </div>
                    <div class="text-left">
                      <p class="font-medium text-gray-900 dark:text-white group-hover:text-primary">Take selfie with this device</p>
                      <p class="text-xs text-gray-500 dark:text-slate-400">Opens your camera for a live photo</p>
                    </div>
                  </button>

                  <button
                    @click="startMobileCapture('selfie')"
                    class="w-full px-6 py-4 rounded-lg border-2 border-gray-300 dark:border-slate-600 hover:border-primary transition-all flex items-center gap-3 group"
                  >
                    <div class="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <Smartphone class="w-5 h-5 text-blue-600" />
                    </div>
                    <div class="text-left">
                      <p class="font-medium text-gray-900 dark:text-white group-hover:text-primary">Take selfie on your phone</p>
                      <p class="text-xs text-gray-500 dark:text-slate-400">Scan a QR code to use your phone's camera</p>
                    </div>
                  </button>

                  <button
                    @click="($refs.selfieFileInput as HTMLInputElement).click()"
                    class="w-full px-6 py-4 rounded-lg border-2 border-gray-300 dark:border-slate-600 hover:border-primary transition-all flex items-center gap-3 group"
                  >
                    <div class="w-10 h-10 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center">
                      <Upload class="w-5 h-5 text-gray-600 dark:text-slate-400" />
                    </div>
                    <div class="text-left">
                      <p class="font-medium text-gray-900 dark:text-white group-hover:text-primary">Upload an existing photo</p>
                      <p class="text-xs text-gray-500 dark:text-slate-400">Choose a recent, clear photo of your face</p>
                    </div>
                  </button>
                  <input ref="selfieFileInput" type="file" class="hidden" accept="image/*" @change="handleSelfieFileUpload" />
                </div>
              </div>
            </div>

            <!-- QR Code Modal -->
            <div v-if="aml.showQr" class="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" @click.self="stopMobilePolling">
              <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
                <div class="flex items-center justify-between">
                  <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Scan with your phone</h3>
                  <button @click="stopMobilePolling" class="text-gray-400 hover:text-gray-600">
                    <X class="w-6 h-6" />
                  </button>
                </div>
                <div class="flex justify-center">
                  <div class="bg-white p-4 rounded-xl shadow-inner">
                    <img v-if="aml.qrDataUrl" :src="aml.qrDataUrl" alt="QR Code" class="w-48 h-48" />
                    <div v-else class="w-48 h-48 flex items-center justify-center">
                      <Loader2 class="w-8 h-8 animate-spin text-gray-400" />
                    </div>
                  </div>
                </div>
                <p class="text-sm text-gray-600 dark:text-slate-400 text-center">
                  Open your phone's camera and point it at this QR code. Take your selfie on your phone and it will appear here automatically.
                </p>
                <div v-if="aml.mobilePolling" class="flex items-center justify-center gap-2 text-sm text-primary">
                  <Loader2 class="w-4 h-4 animate-spin" />
                  Waiting for photo from your phone...
                </div>
              </div>
            </div>

            <!-- Camera error -->
            <p v-if="aml.cameraError" class="text-red-500 text-sm flex items-center gap-2">
              <AlertCircle class="w-4 h-4" /> {{ aml.cameraError }}
            </p>

            <p v-if="fieldError" class="text-red-500 text-sm">{{ fieldError }}</p>

            <!-- Continue button — prominent when both docs are ready -->
            <div v-if="(landlord.idDocument || aml.idDocUrl) && (landlord.selfie || aml.selfieUrl)" class="pt-2">
              <button
                @click="validateAndNext"
                class="w-full px-8 py-4 bg-primary text-white text-lg font-medium rounded-lg hover:bg-primary/90 transition-all"
              >
                Continue
              </button>
            </div>
            <OkButton v-else @click="validateAndNext" />

            <!-- Security notice -->
            <div class="flex items-start gap-3 p-3 bg-gray-50 dark:bg-slate-800/50 rounded-lg border border-gray-200 dark:border-slate-700 mt-2">
              <Lock class="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
              <p class="text-xs text-gray-500 dark:text-slate-400">
                <strong class="text-gray-700 dark:text-slate-300">Your data is protected.</strong>
                Photos are encrypted during transfer and storage. Used only for AML identity verification in accordance with GDPR.
              </p>
            </div>
          </div>

          <!-- ==================== BANK QUESTION ==================== -->
          <div v-else-if="currentStep === 'bankQuestion'" key="bankQuestion" class="space-y-6">
            <div>
              <p class="text-sm font-medium text-primary mb-2">11 &rarr;</p>
              <h2 class="text-3xl font-bold text-gray-900 dark:text-white">Would you like to add bank details?</h2>
              <p class="text-gray-500 dark:text-slate-400 mt-1">
                These are included in tenancy agreements so tenants know where to pay rent. You can add them later.
              </p>
            </div>
            <div class="space-y-3">
              <button
                @click="landlord.wantsBankDetails = true; goNext()"
                class="w-full text-left px-6 py-4 rounded-lg border-2 border-gray-300 dark:border-slate-600 hover:border-primary transition-all flex items-center justify-between group"
              >
                <div>
                  <p class="font-medium text-gray-900 dark:text-white group-hover:text-primary">Yes, add now</p>
                  <p class="text-sm text-gray-500 dark:text-slate-400">Add your bank details for agreements</p>
                </div>
                <ChevronRight class="w-5 h-5 text-gray-400 group-hover:text-primary" />
              </button>
              <button
                @click="landlord.wantsBankDetails = false; skipToStep('plan')"
                class="w-full text-left px-6 py-4 rounded-lg border-2 border-gray-300 dark:border-slate-600 hover:border-primary transition-all flex items-center justify-between group"
              >
                <div>
                  <p class="font-medium text-gray-900 dark:text-white group-hover:text-primary">Skip for now</p>
                  <p class="text-sm text-gray-500 dark:text-slate-400">You can add these later in Settings</p>
                </div>
                <ChevronRight class="w-5 h-5 text-gray-400 group-hover:text-primary" />
              </button>
            </div>
          </div>

          <!-- ==================== BANK DETAILS ==================== -->
          <div v-else-if="currentStep === 'bankDetails'" key="bankDetails" class="space-y-6">
            <div>
              <p class="text-sm font-medium text-primary mb-2">11b &rarr;</p>
              <h2 class="text-3xl font-bold text-gray-900 dark:text-white">Your bank details</h2>
              <p class="text-gray-500 dark:text-slate-400 mt-1">For rent payments in tenancy agreements</p>
            </div>
            <div class="space-y-4">
              <input
                ref="activeInput"
                v-model="landlord.bankAccountName"
                type="text"
                placeholder="Account name (e.g. John Smith)"
                class="typeform-input"
                @keydown.enter.prevent="focusNextBankField('bankAccountNumber')"
              />
              <div class="grid grid-cols-2 gap-4">
                <input
                  ref="bankAccountNumber"
                  v-model="landlord.bankAccountNumber"
                  type="text"
                  placeholder="Account number"
                  maxlength="8"
                  class="typeform-input"
                  @input="formatAccountNumber"
                  @keydown.enter.prevent="focusNextBankField('bankSortCode')"
                />
                <input
                  ref="bankSortCode"
                  v-model="landlord.bankSortCode"
                  type="text"
                  placeholder="Sort code (12-34-56)"
                  maxlength="8"
                  class="typeform-input"
                  @input="formatSortCode"
                  @keydown.enter.prevent="validateAndNext"
                />
              </div>
            </div>
            <p v-if="fieldError" class="text-red-500 text-sm">{{ fieldError }}</p>
            <OkButton @click="validateAndNext" />
          </div>

          <!-- ==================== PLAN SELECTION ==================== -->
          <div v-else-if="currentStep === 'plan'" key="plan" class="space-y-6">
            <div>
              <p class="text-sm font-medium text-primary mb-2">12 &rarr;</p>
              <h2 class="text-3xl font-bold text-gray-900 dark:text-white">Choose your plan</h2>
              <p class="text-gray-500 dark:text-slate-400 mt-1">You can change your plan at any time</p>
            </div>

            <div class="space-y-4">
              <!-- PAYG -->
              <button
                @click="landlord.selectedPlan = 'payg'; skipPaymentAndSave()"
                class="w-full text-left px-6 py-5 rounded-xl border-2 transition-all"
                :class="landlord.selectedPlan === 'payg'
                  ? 'border-primary bg-primary/5'
                  : 'border-gray-300 dark:border-slate-600 hover:border-primary/50'"
              >
                <div class="flex items-start justify-between">
                  <div>
                    <p class="text-lg font-semibold text-gray-900 dark:text-white">Pay As You Go</p>
                    <p class="text-sm text-gray-500 dark:text-slate-400 mt-1">Pay per reference — no commitment</p>
                  </div>
                  <div class="text-right">
                    <p class="text-2xl font-bold text-gray-900 dark:text-white">£17.50</p>
                    <p class="text-xs text-gray-500">per reference</p>
                  </div>
                </div>
              </button>

              <!-- Standard -->
              <button
                @click="landlord.selectedPlan = 'standard'; goNext()"
                class="w-full text-left px-6 py-5 rounded-xl border-2 transition-all relative overflow-hidden"
                :class="landlord.selectedPlan === 'standard'
                  ? 'border-primary bg-primary/5'
                  : 'border-gray-300 dark:border-slate-600 hover:border-primary/50'"
              >
                <div v-if="isPromo" class="absolute top-0 right-0 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                  LAUNCH OFFER
                </div>
                <div class="flex items-start justify-between">
                  <div>
                    <p class="text-lg font-semibold text-gray-900 dark:text-white">Standard</p>
                    <p class="text-sm text-gray-500 dark:text-slate-400 mt-1">Up to {{ STANDARD_MAX_PROPERTIES }} properties &bull; £13/ref</p>
                    <ul class="text-xs text-gray-500 dark:text-slate-400 mt-2 space-y-1">
                      <li>&#10003; Tenancy management</li>
                      <li>&#10003; Discounted references</li>
                      <li>&#10003; Agreements included</li>
                    </ul>
                  </div>
                  <div class="text-right">
                    <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ formatPrice(standardPrice) }}</p>
                    <p class="text-xs text-gray-500">per month</p>
                    <p v-if="isPromo" class="text-xs text-green-600 mt-1 line-through">{{ formatPrice(STANDARD_PRICE) }}/mo after</p>
                  </div>
                </div>
              </button>

              <!-- Professional -->
              <button
                @click="landlord.selectedPlan = 'professional'; goNext()"
                class="w-full text-left px-6 py-5 rounded-xl border-2 transition-all"
                :class="landlord.selectedPlan === 'professional'
                  ? 'border-primary bg-primary/5'
                  : 'border-gray-300 dark:border-slate-600 hover:border-primary/50'"
              >
                <div class="flex items-start justify-between">
                  <div>
                    <p class="text-lg font-semibold text-gray-900 dark:text-white">Professional</p>
                    <p class="text-sm text-gray-500 dark:text-slate-400 mt-1">Up to {{ PROFESSIONAL_MAX_PROPERTIES }} properties &bull; £13/ref</p>
                    <ul class="text-xs text-gray-500 dark:text-slate-400 mt-2 space-y-1">
                      <li>&#10003; Everything in Standard</li>
                      <li>&#10003; Up to 25 properties</li>
                      <li>&#10003; Priority support</li>
                    </ul>
                  </div>
                  <div class="text-right">
                    <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ formatPrice(PROFESSIONAL_PRICE) }}</p>
                    <p class="text-xs text-gray-500">per month</p>
                  </div>
                </div>
              </button>
            </div>
          </div>

          <!-- ==================== PAYMENT METHOD ==================== -->
          <div v-else-if="currentStep === 'payment'" key="payment" class="space-y-6">
            <div>
              <p class="text-sm font-medium text-primary mb-2">13 &rarr;</p>
              <h2 class="text-3xl font-bold text-gray-900 dark:text-white">Add a payment method</h2>
              <p class="text-gray-500 dark:text-slate-400 mt-1">
                <template v-if="landlord.selectedPlan === 'payg'">
                  You'll only be charged when you run a reference or create an agreement.
                </template>
                <template v-else>
                  Your {{ landlord.selectedPlan === 'standard' ? 'Standard' : 'Professional' }} subscription will start immediately.
                </template>
              </p>
            </div>

            <div class="border border-gray-300 dark:border-slate-600 rounded-lg p-4 bg-white dark:bg-slate-900">
              <div id="payment-element"></div>
            </div>
            <p class="text-xs text-gray-500 dark:text-slate-400">Secured by Stripe. Your card details are never stored on our servers.</p>

            <p v-if="fieldError" class="text-red-500 text-sm">{{ fieldError }}</p>

            <button
              @click="handlePayment"
              :disabled="paymentProcessing || !stripeReady"
              class="w-full px-8 py-4 bg-primary text-white text-lg font-medium rounded-lg hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span v-if="paymentProcessing">Processing...</span>
              <span v-else-if="!stripeReady">Loading...</span>
              <span v-else-if="landlord.selectedPlan === 'payg'">Save Payment Method</span>
              <span v-else>Subscribe &amp; Continue</span>
            </button>
          </div>

          <!-- ==================== SAVE LANDLORD (processing) ==================== -->
          <div v-else-if="currentStep === 'saving'" key="saving" class="text-center space-y-6">
            <div class="animate-spin rounded-full h-16 w-16 border-4 border-primary border-t-transparent mx-auto"></div>
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white">Setting up your account...</h2>
            <p class="text-gray-500 dark:text-slate-400">{{ savingStatus }}</p>
          </div>

          <!-- ==================== AML RESULT ==================== -->
          <div v-else-if="currentStep === 'amlResult'" key="amlResult" class="text-center space-y-6">
            <template v-if="amlResult?.passed">
              <div class="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle class="w-10 h-10 text-green-600" />
              </div>
              <h2 class="text-3xl font-bold text-gray-900 dark:text-white">Identity Verified</h2>
              <p class="text-gray-500 dark:text-slate-400 max-w-md mx-auto">
                Your AML check has passed. Your identity has been verified and saved to your account.
              </p>
              <div class="inline-flex items-center gap-2 px-4 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-full">
                <span class="w-2 h-2 bg-green-500 rounded-full"></span>
                <span class="text-sm font-medium text-green-700 dark:text-green-300">AML Status: Verified</span>
              </div>
            </template>
            <template v-else>
              <div class="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle class="w-10 h-10 text-amber-600" />
              </div>
              <h2 class="text-3xl font-bold text-gray-900 dark:text-white">Verification Submitted</h2>
              <p class="text-gray-500 dark:text-slate-400 max-w-md mx-auto">
                {{ amlResult?.message || 'Your documents have been submitted for review. We\'ll notify you once verification is complete.' }}
              </p>
              <div class="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-full">
                <span class="w-2 h-2 bg-amber-500 rounded-full"></span>
                <span class="text-sm font-medium text-amber-700 dark:text-amber-300">AML Status: Under Review</span>
              </div>
            </template>
            <div class="pt-4">
              <button
                @click="goNext"
                class="px-10 py-4 bg-primary text-white text-lg font-medium rounded-lg hover:bg-primary/90 transition-all"
              >
                Continue
              </button>
            </div>
          </div>

          <!-- ==================== ADD PROPERTY QUESTION ==================== -->
          <div v-else-if="currentStep === 'propertyQuestion'" key="propertyQuestion" class="space-y-6">
            <div class="text-center mb-8">
              <CheckCircle class="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 class="text-3xl font-bold text-gray-900 dark:text-white">You're all set!</h2>
              <p class="text-gray-500 dark:text-slate-400 mt-2">Your landlord profile is complete. Would you like to add your first property?</p>
            </div>
            <div class="space-y-3">
              <button
                @click="landlord.wantsProperty = true; goNext()"
                class="w-full text-left px-6 py-4 rounded-lg border-2 border-gray-300 dark:border-slate-600 hover:border-primary transition-all flex items-center justify-between group"
              >
                <div>
                  <p class="font-medium text-gray-900 dark:text-white group-hover:text-primary">Yes, add a property</p>
                  <p class="text-sm text-gray-500 dark:text-slate-400">Set up your first rental property now</p>
                </div>
                <ChevronRight class="w-5 h-5 text-gray-400 group-hover:text-primary" />
              </button>
              <button
                @click="completeOnboarding"
                class="w-full text-left px-6 py-4 rounded-lg border-2 border-gray-300 dark:border-slate-600 hover:border-primary transition-all flex items-center justify-between group"
              >
                <div>
                  <p class="font-medium text-gray-900 dark:text-white group-hover:text-primary">No, go to dashboard</p>
                  <p class="text-sm text-gray-500 dark:text-slate-400">You can add properties later</p>
                </div>
                <ChevronRight class="w-5 h-5 text-gray-400 group-hover:text-primary" />
              </button>
            </div>
          </div>

          <!-- ==================== PROPERTY: ADDRESS ==================== -->
          <div v-else-if="currentStep === 'propAddress'" key="propAddress" class="space-y-6">
            <div>
              <p class="text-sm font-medium text-primary mb-2">Property &rarr;</p>
              <h2 class="text-3xl font-bold text-gray-900 dark:text-white">What's the property address? <span class="text-red-500">*</span></h2>
            </div>

            <AddressAutocomplete
              ref="propAddressAutocomplete"
              v-model="propAddressSearch"
              placeholder="Start typing the property address..."
              id="prop-address"
              class="typeform-address-wrap"
              @address-selected="handlePropAddressSelected"
            />

            <Transition name="fade">
              <div v-if="property.addressLine1 && property.city && property.postcode" class="space-y-3">
                <div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-5">
                  <div class="flex items-start justify-between">
                    <div class="space-y-0.5">
                      <p class="text-base font-medium text-gray-900 dark:text-white">{{ property.addressLine1 }}</p>
                      <p v-if="property.addressLine2" class="text-sm text-gray-600 dark:text-slate-400">{{ property.addressLine2 }}</p>
                      <p class="text-sm text-gray-600 dark:text-slate-400">{{ property.city }}<span v-if="property.county">, {{ property.county }}</span>, {{ property.postcode }}</p>
                    </div>
                    <button @click="clearPropAddress" class="text-xs text-gray-400 hover:text-red-500 underline flex-shrink-0 ml-4">Change</button>
                  </div>
                </div>
                <div class="flex justify-end">
                  <button
                    @click="validateAndNext"
                    class="text-xs text-gray-400 dark:text-slate-500 flex items-center gap-1.5 hover:text-gray-600 transition-colors"
                  >
                    press <kbd class="px-1.5 py-0.5 bg-gray-100 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded text-[10px] font-mono font-semibold text-gray-500 dark:text-slate-400">Enter &#8629;</kbd>
                  </button>
                </div>
              </div>
            </Transition>

            <p v-if="fieldError" class="text-red-500 text-sm">{{ fieldError }}</p>
          </div>

          <!-- ==================== PROPERTY: TYPE ==================== -->
          <div v-else-if="currentStep === 'propType'" key="propType" class="space-y-6">
            <div>
              <p class="text-sm font-medium text-primary mb-2">Property &rarr;</p>
              <h2 class="text-3xl font-bold text-gray-900 dark:text-white">What type of property is it?</h2>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <button
                v-for="pt in propertyTypes"
                :key="pt.value"
                @click="property.propertyType = pt.value; goNext()"
                class="px-5 py-4 rounded-lg border-2 text-left transition-all"
                :class="property.propertyType === pt.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 hover:border-primary/50'"
              >
                <p class="font-medium">{{ pt.label }}</p>
              </button>
            </div>
          </div>

          <!-- ==================== PROPERTY: BEDROOMS + BATHROOMS ==================== -->
          <div v-else-if="currentStep === 'propRooms'" key="propRooms" class="space-y-6">
            <div>
              <p class="text-sm font-medium text-primary mb-2">Property &rarr;</p>
              <h2 class="text-3xl font-bold text-gray-900 dark:text-white">How many bedrooms and bathrooms?</h2>
            </div>
            <div class="grid grid-cols-2 gap-6">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Bedrooms</label>
                <div class="flex items-center gap-3">
                  <button @click="property.bedrooms = Math.max(0, (property.bedrooms || 0) - 1)" class="w-10 h-10 rounded-lg border-2 border-gray-300 dark:border-slate-600 flex items-center justify-center hover:border-primary text-xl font-bold text-gray-600 dark:text-slate-300">-</button>
                  <span class="text-3xl font-bold text-gray-900 dark:text-white w-12 text-center">{{ property.bedrooms || 0 }}</span>
                  <button @click="property.bedrooms = (property.bedrooms || 0) + 1" class="w-10 h-10 rounded-lg border-2 border-gray-300 dark:border-slate-600 flex items-center justify-center hover:border-primary text-xl font-bold text-gray-600 dark:text-slate-300">+</button>
                </div>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Bathrooms</label>
                <div class="flex items-center gap-3">
                  <button @click="property.bathrooms = Math.max(0, (property.bathrooms || 0) - 1)" class="w-10 h-10 rounded-lg border-2 border-gray-300 dark:border-slate-600 flex items-center justify-center hover:border-primary text-xl font-bold text-gray-600 dark:text-slate-300">-</button>
                  <span class="text-3xl font-bold text-gray-900 dark:text-white w-12 text-center">{{ property.bathrooms || 0 }}</span>
                  <button @click="property.bathrooms = (property.bathrooms || 0) + 1" class="w-10 h-10 rounded-lg border-2 border-gray-300 dark:border-slate-600 flex items-center justify-center hover:border-primary text-xl font-bold text-gray-600 dark:text-slate-300">+</button>
                </div>
              </div>
            </div>
            <OkButton @click="goNext" />
          </div>

          <!-- ==================== PROPERTY: FURNISHING ==================== -->
          <div v-else-if="currentStep === 'propFurnishing'" key="propFurnishing" class="space-y-6">
            <div>
              <p class="text-sm font-medium text-primary mb-2">Property &rarr;</p>
              <h2 class="text-3xl font-bold text-gray-900 dark:text-white">Is the property furnished?</h2>
            </div>
            <div class="space-y-3">
              <button
                v-for="f in furnishingOptions"
                :key="f.value"
                @click="property.furnishingStatus = f.value; goNext()"
                class="w-full text-left px-6 py-4 rounded-lg border-2 transition-all"
                :class="property.furnishingStatus === f.value
                  ? 'border-primary bg-primary/10'
                  : 'border-gray-300 dark:border-slate-600 hover:border-primary/50'"
              >
                <p class="font-medium text-gray-900 dark:text-white">{{ f.label }}</p>
              </button>
            </div>
          </div>

          <!-- ==================== PROPERTY: COUNCIL TAX ==================== -->
          <div v-else-if="currentStep === 'propCouncilTax'" key="propCouncilTax" class="space-y-6">
            <div>
              <p class="text-sm font-medium text-primary mb-2">Property &rarr;</p>
              <h2 class="text-3xl font-bold text-gray-900 dark:text-white">What's the council tax band?</h2>
              <p class="text-gray-500 dark:text-slate-400 mt-1">Optional — select if you know it</p>
            </div>
            <div class="flex flex-wrap gap-3">
              <button
                v-for="band in ['A','B','C','D','E','F','G','H']"
                :key="band"
                @click="property.councilTaxBand = band; goNext()"
                class="w-14 h-14 rounded-lg border-2 text-lg font-bold transition-all flex items-center justify-center"
                :class="property.councilTaxBand === band
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 hover:border-primary/50'"
              >
                {{ band }}
              </button>
            </div>
            <button @click="goNext()" class="text-sm text-gray-500 hover:text-gray-700 underline">Skip</button>
          </div>

          <!-- ==================== PROPERTY: BILLS ==================== -->
          <div v-else-if="currentStep === 'propBills'" key="propBills" class="space-y-6">
            <div>
              <p class="text-sm font-medium text-primary mb-2">Property &rarr;</p>
              <h2 class="text-3xl font-bold text-gray-900 dark:text-white">Are bills included in the rent?</h2>
            </div>
            <div class="flex gap-4">
              <button
                @click="property.billsIncluded = true; saveProperty()"
                class="flex-1 px-6 py-4 rounded-lg border-2 text-lg font-medium transition-all"
                :class="property.billsIncluded === true
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 hover:border-primary/50'"
              >
                Yes
              </button>
              <button
                @click="property.billsIncluded = false; saveProperty()"
                class="flex-1 px-6 py-4 rounded-lg border-2 text-lg font-medium transition-all"
                :class="property.billsIncluded === false
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 hover:border-primary/50'"
              >
                No
              </button>
            </div>
          </div>

          <!-- ==================== ADD ANOTHER PROPERTY ==================== -->
          <div v-else-if="currentStep === 'propAnother'" key="propAnother" class="space-y-6">
            <div class="text-center mb-4">
              <CheckCircle class="w-12 h-12 text-green-500 mx-auto mb-3" />
              <h2 class="text-3xl font-bold text-gray-900 dark:text-white">Property added!</h2>
              <p class="text-gray-500 dark:text-slate-400 mt-1">{{ propertiesAdded }} {{ propertiesAdded === 1 ? 'property' : 'properties' }} added so far</p>
            </div>
            <div class="space-y-3">
              <button
                @click="resetPropertyForm(); skipToStep('propAddress')"
                class="w-full text-left px-6 py-4 rounded-lg border-2 border-gray-300 dark:border-slate-600 hover:border-primary transition-all flex items-center justify-between group"
              >
                <div>
                  <p class="font-medium text-gray-900 dark:text-white group-hover:text-primary">Add another property</p>
                </div>
                <ChevronRight class="w-5 h-5 text-gray-400 group-hover:text-primary" />
              </button>
              <button
                @click="completeOnboarding"
                class="w-full text-left px-6 py-4 rounded-lg border-2 border-primary bg-primary/5 transition-all flex items-center justify-between group"
              >
                <div>
                  <p class="font-medium text-primary">I'm done — go to dashboard</p>
                </div>
                <ChevronRight class="w-5 h-5 text-primary" />
              </button>
            </div>
          </div>

          <!-- ==================== COMPLETE ==================== -->
          <div v-else-if="currentStep === 'complete'" key="complete" class="text-center space-y-6">
            <div class="animate-spin rounded-full h-16 w-16 border-4 border-primary border-t-transparent mx-auto"></div>
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white">Taking you to your dashboard...</h2>
          </div>
        </TransitionGroup>
      </div>
    </div>

    <!-- Footer: Save & Exit -->
    <div v-if="currentStepIndex > 0 && !['saving', 'complete'].includes(currentStep)" class="text-center pb-6">
      <button
        @click="handleSaveAndExit"
        class="text-sm text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300 underline"
      >
        Save progress and continue later
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { loadStripe } from '@stripe/stripe-js'
import axios from 'axios'
import {
  ArrowLeft, ChevronRight, CheckCircle, Upload, Camera,
  Smartphone, X, Loader2, AlertCircle, Lock
} from 'lucide-vue-next'
import QRCode from 'qrcode'
import {
  formatPrice,
  isPromoPeriod,
  getStandardPrice,
  STANDARD_PRICE,
  STANDARD_MAX_PROPERTIES,
  PROFESSIONAL_PRICE,
  PROFESSIONAL_MAX_PROPERTIES
} from '../utils/pricing'
import AddressAutocomplete from '../components/AddressAutocomplete.vue'

// ─── Sub-component ───
import OkButton from '../components/onboarding/OkButton.vue'
import EnterHint from '../components/onboarding/EnterHint.vue'

const router = useRouter()
const authStore = useAuthStore()
const API_URL = import.meta.env.VITE_API_URL

// ─── Step definitions ───
const LANDLORD_STEPS = [
  'welcome', 'title', 'firstName', 'lastName', 'middleName',
  'dateOfBirth', 'phone', 'contractName', 'emailGreeting',
  'address', 'aml', 'bankQuestion', 'bankDetails',
  'plan', 'payment', 'saving', 'amlResult', 'propertyQuestion'
] as const

const PROPERTY_STEPS = [
  'propAddress', 'propType', 'propRooms', 'propFurnishing',
  'propCouncilTax', 'propBills', 'propAnother'
] as const

const currentStep = ref<string>('welcome')
const transitionDirection = ref<'slide-up' | 'slide-down'>('slide-up')
const stepHistory = ref<string[]>([])
const fieldError = ref('')

// ─── Landlord data ───
const landlord = ref({
  title: '',
  firstName: '',
  lastName: '',
  middleName: '',
  dateOfBirth: '',
  phone: '',
  contractName: '',
  emailGreeting: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  postcode: '',
  country: 'GB',
  idDocument: null as File | null,
  selfie: null as File | null,
  idDocumentType: '',
  wantsBankDetails: false,
  bankAccountName: '',
  bankAccountNumber: '',
  bankSortCode: '',
  selectedPlan: '',
  wantsProperty: false,
})

// ─── Property data ───
const property = ref({
  addressLine1: '',
  addressLine2: '',
  city: '',
  county: '',
  postcode: '',
  propertyType: '',
  bedrooms: null as number | null,
  bathrooms: null as number | null,
  furnishingStatus: '',
  councilTaxBand: '',
  billsIncluded: false as boolean,
})

const amlResult = ref<{ passed: boolean; risk_level: string; message: string } | null>(null)
const propertiesAdded = ref(0)
const savingStatus = ref('')
const paymentProcessing = ref(false)
const stripeReady = ref(false)
let stripe: any = null
let elements: any = null

// ─── AML state ───
const aml = ref({
  cameraActive: false,
  cameraStream: null as MediaStream | null,
  cameraError: '',
  selfiePreview: '',
  selfieBlob: null as Blob | null,
  selfieUrl: '',
  idDocUrl: '',
  idDocFile: null as File | null,
  showQr: false,
  qrDataUrl: '',
  captureToken: '',
  sessionId: '',
  formToken: '',
  mobilePolling: false,
  pollTimer: null as ReturnType<typeof setInterval> | null,
  // ID doc camera
  idCameraActive: false,
  idCameraStream: null as MediaStream | null,
  idDocPreview: '',
  idDocBlob: null as Blob | null,
})

const idDocTypes = [
  { value: 'passport', label: 'Passport' },
  { value: 'driving_licence', label: 'Driving Licence' },
  { value: 'national_id', label: 'National ID' },
]

// ─── Options ───
const propertyTypes = [
  { value: 'house', label: 'House' },
  { value: 'flat', label: 'Flat / Apartment' },
  { value: 'bungalow', label: 'Bungalow' },
  { value: 'studio', label: 'Studio' },
  { value: 'hmo', label: 'HMO' },
  { value: 'other', label: 'Other' },
]

const furnishingOptions = [
  { value: 'furnished', label: 'Furnished' },
  { value: 'unfurnished', label: 'Unfurnished' },
  { value: 'part_furnished', label: 'Part Furnished' },
]

// ─── Computed ───
const isPromo = computed(() => isPromoPeriod())
const standardPrice = computed(() => getStandardPrice())
const maxDob = computed(() => {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 18)
  return d.toISOString().split('T')[0]
})

const allSteps = computed(() => {
  const steps = [...LANDLORD_STEPS]
  // Remove bankDetails if skipped
  if (!landlord.value.wantsBankDetails) {
    const idx = steps.indexOf('bankDetails')
    if (idx > -1) steps.splice(idx, 1)
  }
  // Add property steps if wanted
  if (landlord.value.wantsProperty) {
    steps.push(...PROPERTY_STEPS)
  }
  steps.push('complete')
  return steps
})

const currentStepIndex = computed(() => {
  const idx = allSteps.value.indexOf(currentStep.value)
  return Math.max(0, idx)
})

const totalSteps = computed(() => {
  // Don't count welcome, saving, complete
  return allSteps.value.filter(s => !['welcome', 'saving', 'complete'].includes(s)).length
})

const progressPercentage = computed(() => {
  const visibleSteps = allSteps.value.filter(s => !['welcome', 'saving', 'complete'].includes(s))
  const currentVisible = visibleSteps.indexOf(currentStep.value)
  if (currentVisible < 0) return 100
  return Math.round((currentVisible / visibleSteps.length) * 100)
})

const canGoBack = computed(() => stepHistory.value.length > 0)

const defaultContractName = computed(() => {
  const parts = [landlord.value.title, landlord.value.firstName, landlord.value.middleName, landlord.value.lastName].filter(Boolean)
  return parts.join(' ')
})

// ─── Template refs ───
const activeInput = ref<HTMLInputElement | null>(null)
const addressLine2 = ref<HTMLInputElement | null>(null)
const addressCity = ref<HTMLInputElement | null>(null)
const addressPostcode = ref<HTMLInputElement | null>(null)
const bankAccountNumber = ref<HTMLInputElement | null>(null)
const bankSortCode = ref<HTMLInputElement | null>(null)
const propLine2 = ref<HTMLInputElement | null>(null)
const propCity = ref<HTMLInputElement | null>(null)
const propCounty = ref<HTMLInputElement | null>(null)
const propPostcode = ref<HTMLInputElement | null>(null)
const addressAutocomplete = ref<any>(null)
const propAddressAutocomplete = ref<any>(null)
const propAddressSearch = ref('')
const amlVideo = ref<HTMLVideoElement | null>(null)
const amlCanvas = ref<HTMLCanvasElement | null>(null)
const selfieFileInput = ref<HTMLInputElement | null>(null)
const idVideo = ref<HTMLVideoElement | null>(null)
const idCanvas = ref<HTMLCanvasElement | null>(null)
const dobMonthInput = ref<HTMLInputElement | null>(null)
const dobYearInput = ref<HTMLInputElement | null>(null)

// ─── DOB split fields ───
const dobDay = ref('')
const dobMonth = ref('')
const dobYear = ref('')

function handleDobDay(e: Event) {
  const val = (e.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 2)
  dobDay.value = val
  if (val.length === 2) dobMonthInput.value?.focus()
  syncDob()
}

function handleDobMonth(e: Event) {
  const val = (e.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 2)
  dobMonth.value = val
  if (val.length === 2) dobYearInput.value?.focus()
  syncDob()
}

function handleDobYear(e: Event) {
  const val = (e.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 4)
  dobYear.value = val
  syncDob()
}

function syncDob() {
  if (dobDay.value && dobMonth.value && dobYear.value.length === 4) {
    const d = dobDay.value.padStart(2, '0')
    const m = dobMonth.value.padStart(2, '0')
    landlord.value.dateOfBirth = `${dobYear.value}-${m}-${d}`
  } else {
    landlord.value.dateOfBirth = ''
  }
}

// ─── Navigation ───
function goNext() {
  fieldError.value = ''
  const steps = allSteps.value
  const idx = steps.indexOf(currentStep.value)
  if (idx < steps.length - 1) {
    stepHistory.value.push(currentStep.value)
    transitionDirection.value = 'slide-up'
    currentStep.value = steps[idx + 1]
  }
}

function goBack() {
  fieldError.value = ''
  if (stepHistory.value.length > 0) {
    transitionDirection.value = 'slide-down'
    currentStep.value = stepHistory.value.pop()!
  }
}

function skipToStep(stepId: string) {
  fieldError.value = ''
  stepHistory.value.push(currentStep.value)
  transitionDirection.value = 'slide-up'
  currentStep.value = stepId
}

function validateAndNext() {
  if (validateCurrentStep()) {
    goNext()
  }
}

// ─── Pre-fill on step change ───
watch(currentStep, async (step) => {
  await nextTick()

  // Focus after slide transition completes
  setTimeout(() => {
    if (step === 'address') {
      addressAutocomplete.value?.focus()
    } else if (step === 'propAddress') {
      propAddressAutocomplete.value?.focus()
    } else if (activeInput.value) {
      activeInput.value.focus()
    }
  }, 450)

  // Pre-fill contract name
  if (step === 'contractName' && !landlord.value.contractName) {
    landlord.value.contractName = defaultContractName.value
  }

  // Pre-fill email greeting
  if (step === 'emailGreeting' && !landlord.value.emailGreeting) {
    landlord.value.emailGreeting = landlord.value.firstName
  }

  // Init Stripe on payment step
  if (step === 'payment') {
    initStripe()
  }
})

// ─── Validation ───
function validateCurrentStep(): boolean {
  fieldError.value = ''
  const step = currentStep.value

  if (step === 'firstName') {
    if (!landlord.value.firstName.trim()) {
      fieldError.value = 'First name is required'
      return false
    }
  }

  if (step === 'lastName') {
    if (!landlord.value.lastName.trim()) {
      fieldError.value = 'Last name is required'
      return false
    }
  }

  if (step === 'dateOfBirth') {
    if (!landlord.value.dateOfBirth) {
      fieldError.value = 'Date of birth is required for AML verification'
      return false
    }
    const dob = new Date(landlord.value.dateOfBirth)
    const cutoff = new Date()
    cutoff.setFullYear(cutoff.getFullYear() - 18)
    if (dob > cutoff) {
      fieldError.value = 'You must be at least 18 years old'
      return false
    }
  }

  if (step === 'phone') {
    if (!landlord.value.phone.trim()) {
      fieldError.value = 'Phone number is required'
      return false
    }
    if (!/^[\d\s\+\-\(\)]{7,}$/.test(landlord.value.phone)) {
      fieldError.value = 'Please enter a valid phone number'
      return false
    }
  }

  if (step === 'contractName') {
    if (!landlord.value.contractName.trim()) {
      fieldError.value = 'Contract display name is required'
      return false
    }
  }

  if (step === 'address') {
    if (!landlord.value.addressLine1.trim()) {
      fieldError.value = 'Address line 1 is required'
      return false
    }
    if (!landlord.value.city.trim()) {
      fieldError.value = 'City is required'
      return false
    }
    if (!landlord.value.postcode.trim()) {
      fieldError.value = 'Postcode is required'
      return false
    }
  }

  if (step === 'aml') {
    if (!landlord.value.idDocumentType) {
      fieldError.value = 'Please select your ID document type'
      return false
    }
    if (!landlord.value.idDocument && !aml.value.idDocUrl) {
      fieldError.value = 'Please upload your ID document'
      return false
    }
    if (!landlord.value.selfie && !aml.value.selfieUrl) {
      fieldError.value = 'Please take or upload a selfie'
      return false
    }
  }

  if (step === 'bankDetails') {
    const { bankAccountName, bankAccountNumber, bankSortCode } = landlord.value
    if (!bankAccountName.trim()) {
      fieldError.value = 'Account name is required'
      return false
    }
    if (!bankAccountNumber || bankAccountNumber.length !== 8 || !/^\d{8}$/.test(bankAccountNumber)) {
      fieldError.value = 'Account number must be exactly 8 digits'
      return false
    }
    if (!bankSortCode || !/^\d{2}-\d{2}-\d{2}$/.test(bankSortCode)) {
      fieldError.value = 'Sort code must be in format 12-34-56'
      return false
    }
  }

  if (step === 'propAddress') {
    if (!property.value.addressLine1.trim()) {
      fieldError.value = 'Address line 1 is required'
      return false
    }
    if (!property.value.city.trim()) {
      fieldError.value = 'City is required'
      return false
    }
    if (!property.value.postcode.trim()) {
      fieldError.value = 'Postcode is required'
      return false
    }
  }

  return true
}

// ─── Address autocomplete handler ───
const addressSearch = ref('')

function handleAddressSelected(address: { addressLine1: string; addressLine2?: string; city: string; postcode: string; country: { code: string; name: string } }) {
  landlord.value.addressLine1 = address.addressLine1
  if (address.addressLine2) landlord.value.addressLine2 = address.addressLine2
  landlord.value.city = address.city
  landlord.value.postcode = address.postcode
  if (address.country?.code) landlord.value.country = address.country.code
  // Update search display
  addressSearch.value = address.addressLine1
}

function handlePropAddressSelected(address: { addressLine1: string; addressLine2?: string; city: string; postcode: string; country: { code: string; name: string } }) {
  property.value.addressLine1 = address.addressLine1
  if (address.addressLine2) property.value.addressLine2 = address.addressLine2
  property.value.city = address.city
  property.value.postcode = address.postcode
  propAddressSearch.value = address.addressLine1
}

function clearPropAddress() {
  property.value.addressLine1 = ''
  property.value.addressLine2 = ''
  property.value.city = ''
  property.value.county = ''
  property.value.postcode = ''
  propAddressSearch.value = ''
  nextTick(() => propAddressAutocomplete.value?.focus())
}

function clearAddress() {
  landlord.value.addressLine1 = ''
  landlord.value.addressLine2 = ''
  landlord.value.city = ''
  landlord.value.postcode = ''
  addressSearch.value = ''
  // Re-focus the search
  nextTick(() => addressAutocomplete.value?.focus())
}

// Listen for Enter on address step to advance when address is filled
function handleGlobalKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && currentStep.value === 'address') {
    if (landlord.value.addressLine1 && landlord.value.city && landlord.value.postcode) {
      e.preventDefault()
      validateAndNext()
    }
  }
  if (e.key === 'Enter' && currentStep.value === 'propAddress') {
    if (property.value.addressLine1 && property.value.city && property.value.postcode) {
      e.preventDefault()
      validateAndNext()
    }
  }
}
// Registered in existing onMounted/onBeforeUnmount below

// ─── Focus helpers ───
function focusNextAddressField(refName: string) {
  const refs: Record<string, any> = { addressLine2, addressCity, addressPostcode }
  refs[refName]?.value?.focus()
}

function focusNextBankField(refName: string) {
  const refs: Record<string, any> = { bankAccountNumber, bankSortCode }
  refs[refName]?.value?.focus()
}

function focusRef(refName: string) {
  const refs: Record<string, any> = { propLine2, propCity, propCounty, propPostcode }
  refs[refName]?.value?.focus()
}

// ─── Formatting ───
function formatAccountNumber(e: Event) {
  const input = e.target as HTMLInputElement
  landlord.value.bankAccountNumber = input.value.replace(/\D/g, '').slice(0, 8)
}

function formatSortCode(e: Event) {
  const input = e.target as HTMLInputElement
  let value = input.value.replace(/\D/g, '')
  if (value.length >= 2) value = value.slice(0, 2) + '-' + value.slice(2)
  if (value.length >= 5) value = value.slice(0, 5) + '-' + value.slice(5, 7)
  landlord.value.bankSortCode = value.slice(0, 8)
}

// ─── File uploads ───
function handleIdDocUpload(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (file.size > 10 * 1024 * 1024) {
    fieldError.value = 'File must be under 10MB'
    return
  }
  landlord.value.idDocument = file
  aml.value.idDocFile = file
  fieldError.value = ''
}

function handleSelfieFileUpload(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (file.size > 10 * 1024 * 1024) {
    fieldError.value = 'File must be under 10MB'
    return
  }
  landlord.value.selfie = file
  // Show preview
  const reader = new FileReader()
  reader.onload = (ev) => {
    aml.value.selfiePreview = ev.target?.result as string
  }
  reader.readAsDataURL(file)
  fieldError.value = ''
}

// ─── AML Camera ───
async function startAmlCamera() {
  aml.value.cameraError = ''
  fieldError.value = ''
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } },
      audio: false,
    })
    aml.value.cameraStream = stream
    aml.value.cameraActive = true
    await nextTick()
    if (amlVideo.value) {
      amlVideo.value.srcObject = stream
    }
  } catch (err: any) {
    if (err.name === 'NotAllowedError') {
      aml.value.cameraError = 'Camera access denied. Please allow camera access in your browser settings.'
    } else if (err.name === 'NotFoundError') {
      aml.value.cameraError = 'No camera found. Try using your phone instead (QR option below).'
    } else {
      aml.value.cameraError = 'Unable to access camera. Try the phone or upload option instead.'
    }
  }
}

function stopAmlCamera() {
  if (aml.value.cameraStream) {
    aml.value.cameraStream.getTracks().forEach(t => t.stop())
    aml.value.cameraStream = null
  }
  aml.value.cameraActive = false
  if (amlVideo.value) amlVideo.value.srcObject = null
}

function captureSelfie() {
  if (!amlVideo.value || !amlCanvas.value) return
  const video = amlVideo.value
  const canvas = amlCanvas.value

  let w = video.videoWidth
  let h = video.videoHeight
  const max = 1920
  if (w > max || h > max) {
    if (w > h) { h = Math.round((h / w) * max); w = max }
    else { w = Math.round((w / h) * max); h = max }
  }
  canvas.width = w
  canvas.height = h

  const ctx = canvas.getContext('2d')
  if (ctx) {
    // Un-mirror the selfie
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
  }

  canvas.toBlob((blob) => {
    if (blob) {
      aml.value.selfieBlob = blob
      aml.value.selfiePreview = canvas.toDataURL('image/jpeg', 0.9)
      stopAmlCamera()
    }
  }, 'image/jpeg', 0.9)
}

function confirmSelfieCapture() {
  if (aml.value.selfieBlob) {
    landlord.value.selfie = new File([aml.value.selfieBlob], `selfie-${Date.now()}.jpg`, { type: 'image/jpeg' })
  }
}

function resetSelfie() {
  aml.value.selfiePreview = ''
  aml.value.selfieBlob = null
  aml.value.selfieUrl = ''
  landlord.value.selfie = null
  stopAmlCamera()
}

// ─── ID Document Camera ───
async function startIdCamera() {
  aml.value.cameraError = ''
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
    })
    aml.value.idCameraStream = stream
    aml.value.idCameraActive = true
    await nextTick()
    if (idVideo.value) idVideo.value.srcObject = stream
  } catch (err: any) {
    if (err.name === 'NotAllowedError') {
      aml.value.cameraError = 'Camera access denied. Please allow camera access.'
    } else if (err.name === 'NotFoundError') {
      aml.value.cameraError = 'No camera found. Try uploading a file instead.'
    } else {
      aml.value.cameraError = 'Unable to access camera.'
    }
  }
}

function stopIdCamera() {
  if (aml.value.idCameraStream) {
    aml.value.idCameraStream.getTracks().forEach(t => t.stop())
    aml.value.idCameraStream = null
  }
  aml.value.idCameraActive = false
  if (idVideo.value) idVideo.value.srcObject = null
}

function captureIdPhoto() {
  if (!idVideo.value || !idCanvas.value) return
  const video = idVideo.value
  const canvas = idCanvas.value

  let w = video.videoWidth
  let h = video.videoHeight
  const max = 1920
  if (w > max || h > max) {
    if (w > h) { h = Math.round((h / w) * max); w = max }
    else { w = Math.round((w / h) * max); h = max }
  }
  canvas.width = w
  canvas.height = h

  const ctx = canvas.getContext('2d')
  if (ctx) ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

  canvas.toBlob((blob) => {
    if (blob) {
      aml.value.idDocBlob = blob
      aml.value.idDocPreview = canvas.toDataURL('image/jpeg', 0.9)
      stopIdCamera()
    }
  }, 'image/jpeg', 0.9)
}

function confirmIdCapture() {
  if (aml.value.idDocBlob) {
    landlord.value.idDocument = new File([aml.value.idDocBlob], `id-document-${Date.now()}.jpg`, { type: 'image/jpeg' })
    aml.value.idDocPreview = ''
  }
}

// ─── AML Mobile QR capture ───
async function startMobileCapture(captureType: 'id_document' | 'selfie' = 'selfie') {
  aml.value.cameraError = ''
  fieldError.value = ''

  try {
    const token = authStore.session?.access_token
    const response = await axios.post(
      `${API_URL}/api/landlord-portal/aml/create-session`,
      { capture_type: captureType },
      { headers: { Authorization: `Bearer ${token}` } }
    )

    const { captureToken, captureUrl, landlordId } = response.data
    aml.value.captureToken = captureToken
    aml.value.sessionId = landlordId

    // Generate QR
    aml.value.qrDataUrl = await QRCode.toDataURL(captureUrl, {
      width: 256, margin: 1,
      color: { dark: '#1f2937', light: '#ffffff' }
    })

    aml.value.showQr = true
    aml.value.mobilePolling = true

    // Poll for upload
    aml.value.pollTimer = setInterval(async () => {
      try {
        const statusRes = await axios.get(
          `${API_URL}/api/landlord-portal/aml/poll/${landlordId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        )

        const data = statusRes.data
        if (captureType === 'selfie' && data.selfieUploaded && data.selfieUrl) {
          aml.value.selfieUrl = data.selfieUrl
          aml.value.selfiePreview = data.selfieUrl
          landlord.value.selfie = new File([], 'mobile-selfie.jpg')
          stopMobilePolling()
        }
        if (captureType === 'id_document' && data.idDocUploaded && data.idDocUrl) {
          aml.value.idDocUrl = data.idDocUrl
          landlord.value.idDocument = new File([], 'mobile-id.jpg')
          stopMobilePolling()
        }
      } catch {
        // Silent retry
      }
    }, 3000)
  } catch (err: any) {
    console.error('Mobile capture init error:', err)
    aml.value.cameraError = err.response?.data?.error || 'Failed to start mobile capture. Please try another method.'
  }
}

function stopMobilePolling() {
  if (aml.value.pollTimer) {
    clearInterval(aml.value.pollTimer)
    aml.value.pollTimer = null
  }
  aml.value.showQr = false
  aml.value.mobilePolling = false
}

// ─── Stripe ───
async function initStripe() {
  try {
    const token = authStore.session?.access_token
    const response = await axios.post(
      `${API_URL}/api/billing/setup-intent`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    )

    const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
    stripe = await loadStripe(stripeKey)
    if (!stripe) throw new Error('Failed to load Stripe')

    elements = stripe.elements({
      clientSecret: response.data.clientSecret,
      appearance: {
        theme: 'stripe',
        variables: { colorPrimary: '#fe7a0f' },
      },
    })

    const paymentElement = elements.create('payment')
    await nextTick()
    setTimeout(() => {
      paymentElement.mount('#payment-element')
      stripeReady.value = true
    }, 100)
  } catch (err: any) {
    fieldError.value = err.response?.data?.error || err.message || 'Failed to load payment form'
    console.error('Stripe init error:', err)
  }
}

async function handlePayment() {
  if (!stripe || !elements) return

  paymentProcessing.value = true
  fieldError.value = ''

  try {
    const { setupIntent, error: confirmError } = await stripe.confirmSetup({
      elements,
      confirmParams: { return_url: `${window.location.origin}/onboarding` },
      redirect: 'if_required',
    })

    if (confirmError) {
      fieldError.value = confirmError.message || 'Payment failed'
      return
    }

    const paymentMethodId = typeof setupIntent.payment_method === 'string'
      ? setupIntent.payment_method
      : setupIntent.payment_method.id

    const token = authStore.session?.access_token

    // Save payment method
    await axios.put(
      `${API_URL}/api/billing/payment-methods/default`,
      { payment_method_id: paymentMethodId },
      { headers: { Authorization: `Bearer ${token}` } }
    )

    // Create subscription if not PAYG
    if (landlord.value.selectedPlan !== 'payg') {
      const tierKey = landlord.value.selectedPlan === 'standard'
        ? 'landlord_standard'
        : 'landlord_professional'

      await axios.post(
        `${API_URL}/api/billing/subscriptions`,
        { tier_product_key: tierKey },
        { headers: { Authorization: `Bearer ${token}` } }
      )
    }

    // Now save all landlord data
    goNext() // goes to 'saving'
    await saveLandlordData()
  } catch (err: any) {
    console.error('Payment error:', err)
    fieldError.value = err.response?.data?.error || err.message || 'Payment failed. Please try again.'
  } finally {
    paymentProcessing.value = false
  }
}

// ─── Skip payment for PAYG ───
async function skipPaymentAndSave() {
  // Skip straight to saving step, no Stripe needed
  stepHistory.value.push(currentStep.value)
  transitionDirection.value = 'slide-up'
  currentStep.value = 'saving'
  await saveLandlordData()
}

// ─── Save landlord data ───
async function saveLandlordData() {
  const token = authStore.session?.access_token
  if (!token) return

  try {
    // Step 1: Save profile
    savingStatus.value = 'Saving your profile...'
    await axios.put(
      `${API_URL}/api/profile`,
      {
        fullName: `${landlord.value.firstName} ${landlord.value.lastName}`.trim(),
        phone: landlord.value.phone.trim(),
      },
      { headers: { Authorization: `Bearer ${token}` } }
    )

    // Step 2: Save landlord details
    savingStatus.value = 'Saving landlord information...'
    await axios.put(
      `${API_URL}/api/landlord-portal/profile`,
      {
        title: landlord.value.title,
        first_name: landlord.value.firstName.trim(),
        last_name: landlord.value.lastName.trim(),
        middle_name: landlord.value.middleName.trim(),
        date_of_birth: landlord.value.dateOfBirth,
        phone: landlord.value.phone.trim(),
        email: authStore.user?.email,
        full_name_displayed_on_contracts: landlord.value.contractName.trim(),
        preferred_email_greeting: landlord.value.emailGreeting.trim(),
        residential_address_line1: landlord.value.addressLine1.trim(),
        residential_address_line2: landlord.value.addressLine2.trim(),
        residential_city: landlord.value.city.trim(),
        residential_postcode: landlord.value.postcode.trim().toUpperCase(),
        residential_country: landlord.value.country,
        bank_account_name: landlord.value.bankAccountName.trim() || undefined,
        bank_account_number: landlord.value.bankAccountNumber.trim() || undefined,
        bank_sort_code: landlord.value.bankSortCode.trim() || undefined,
      },
      { headers: { Authorization: `Bearer ${token}` } }
    )

    // Step 3: Submit AML verification (ID doc + selfie + run sanctions check)
    savingStatus.value = 'Submitting identity verification...'
    try {
      const amlFormData = new FormData()

      // Attach ID document (file upload or already-uploaded URL)
      if (landlord.value.idDocument && landlord.value.idDocument.size > 0) {
        amlFormData.append('id_document', landlord.value.idDocument)
      } else if (aml.value.idDocUrl) {
        amlFormData.append('id_document_url', aml.value.idDocUrl)
      }

      // Attach selfie (file or already-uploaded URL from mobile)
      if (aml.value.selfieUrl) {
        amlFormData.append('selfie_url', aml.value.selfieUrl)
      } else if (landlord.value.selfie && landlord.value.selfie.size > 0) {
        amlFormData.append('selfie', landlord.value.selfie)
      } else if (aml.value.selfieBlob) {
        amlFormData.append('selfie', new File([aml.value.selfieBlob], `selfie-${Date.now()}.jpg`, { type: 'image/jpeg' }))
      }

      amlFormData.append('id_document_type', landlord.value.idDocumentType)
      amlFormData.append('first_name', landlord.value.firstName.trim())
      amlFormData.append('last_name', landlord.value.lastName.trim())
      amlFormData.append('date_of_birth', landlord.value.dateOfBirth)
      amlFormData.append('address_line1', landlord.value.addressLine1.trim())
      amlFormData.append('address_line2', landlord.value.addressLine2.trim())
      amlFormData.append('city', landlord.value.city.trim())
      amlFormData.append('postcode', landlord.value.postcode.trim().toUpperCase())
      amlFormData.append('country', landlord.value.country)

      // Submit documents + trigger AML sanctions screening
      const amlResponse = await axios.post(
        `${API_URL}/api/landlord-portal/aml/submit`,
        amlFormData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      )

      console.log('AML verification result:', amlResponse.data)
      amlResult.value = amlResponse.data
    } catch (amlErr: any) {
      console.error('AML submission error:', amlErr)
      amlResult.value = { passed: false, risk_level: 'pending', message: 'Verification submitted — results pending.' }
    }

    savingStatus.value = 'Finalising account...'
    goNext() // goes to 'amlResult'
  } catch (err: any) {
    const detail = err.response?.data?.error || err.message || 'Unknown error'
    console.error('Save error at step:', savingStatus.value, '|', detail, err)
    savingStatus.value = `Issue: ${detail} — continuing anyway...`
    // Don't block — still move to property question after a brief pause
    setTimeout(() => {
      goNext()
    }, 2500)
  }
}

// ─── Save property ───
async function saveProperty() {
  const token = authStore.session?.access_token
  if (!token) return

  try {
    await axios.post(
      `${API_URL}/api/properties`,
      {
        address_line1: property.value.addressLine1.trim(),
        address_line2: property.value.addressLine2.trim(),
        city: property.value.city.trim(),
        county: property.value.county.trim(),
        postcode: property.value.postcode.trim().toUpperCase(),
        property_type: property.value.propertyType,
        number_of_bedrooms: property.value.bedrooms,
        number_of_bathrooms: property.value.bathrooms,
        furnishing_status: property.value.furnishingStatus,
        council_tax_band: property.value.councilTaxBand || null,
        bills_included: property.value.billsIncluded,
      },
      { headers: { Authorization: `Bearer ${token}` } }
    )
    propertiesAdded.value++
    goNext() // goes to propAnother
  } catch (err: any) {
    console.error('Property save error:', err)
    fieldError.value = err.response?.data?.error || 'Failed to save property. Please try again.'
  }
}

function resetPropertyForm() {
  property.value = {
    addressLine1: '',
    addressLine2: '',
    city: '',
    county: '',
    postcode: '',
    propertyType: '',
    bedrooms: null,
    bathrooms: null,
    furnishingStatus: '',
    councilTaxBand: '',
    billsIncluded: false,
  }
  propAddressSearch.value = ''
}

// ─── Complete ───
async function completeOnboarding() {
  currentStep.value = 'complete'

  try {
    const token = authStore.session?.access_token
    await axios.post(
      `${API_URL}/api/landlord-portal/onboarding/complete`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    )
    await authStore.fetchUser()
    setTimeout(() => router.push('/dashboard'), 1000)
  } catch (err: any) {
    console.error('Complete error:', err)
    router.push('/dashboard')
  }
}

// ─── Save & exit ───
async function handleSaveAndExit() {
  try {
    const token = authStore.session?.access_token
    await axios.put(
      `${API_URL}/api/onboarding/step`,
      { step: currentStep.value },
      { headers: { Authorization: `Bearer ${token}` } }
    )
    router.push('/dashboard')
  } catch {
    router.push('/dashboard')
  }
}

// ─── Cleanup ───
onBeforeUnmount(() => {
  stopAmlCamera()
  stopIdCamera()
  stopMobilePolling()
  window.removeEventListener('keydown', handleGlobalKeydown)
})

// ─── Load saved progress ───
onMounted(async () => {
  window.addEventListener('keydown', handleGlobalKeydown)
  try {
    const token = authStore.session?.access_token
    if (!token) {
      router.push('/login')
      return
    }

    // Ensure landlord + company records exist before checking onboarding status
    try {
      await axios.put(
        `${API_URL}/api/landlord-portal/profile`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      )
    } catch {
      // Non-blocking — profile may already exist
    }

    const response = await axios.get(`${API_URL}/api/onboarding/status`, {
      headers: { Authorization: `Bearer ${token}` }
    })

    if (response.data.onboardingCompleted || response.data.shouldSkipOnboarding) {
      router.push('/dashboard')
      return
    }

    // Resume from saved step
    const saved = response.data.currentStep
    if (saved && saved !== 0) {
      if (typeof saved === 'string' && LANDLORD_STEPS.includes(saved as any)) {
        // Saved as step name (new format)
        currentStep.value = saved
      } else if (typeof saved === 'number' && saved > 0) {
        // Saved as index (old format) — map to step name
        const steps = allSteps.value
        if (saved < steps.length) {
          currentStep.value = steps[saved]
        }
      }
    }
  } catch (error) {
    console.error('Error loading onboarding status:', error)
  }
})
</script>

<style scoped>
.typeform-input {
  @apply w-full px-0 py-3 text-2xl bg-transparent border-0 border-b-2 border-gray-300 dark:border-slate-600
    text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500
    focus:outline-none focus:border-primary focus:ring-0 transition-colors;
}

.text-uppercase {
  text-transform: uppercase;
}

/* Style AddressAutocomplete to match typeform inputs */
.typeform-address-wrap :deep(input) {
  @apply w-full px-0 py-3 text-2xl bg-transparent border-0 border-b-2 border-gray-300 dark:border-slate-600
    text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500
    focus:outline-none focus:border-primary focus:ring-0 transition-colors rounded-none;
  margin-top: 0 !important;
}
.typeform-address-wrap :deep(label) {
  display: none;
}
.typeform-address-wrap :deep(p) {
  display: none;
}
.typeform-address-wrap :deep(.absolute) {
  margin-top: 0.5rem;
  border-radius: 0.75rem;
  border: none;
  box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1);
  overflow: hidden;
}
.typeform-address-wrap :deep(.absolute > div) {
  padding: 0.875rem 1.25rem;
  font-size: 1rem;
  color: #374151;
  border-bottom: 1px solid #f3f4f6;
  cursor: pointer;
}
.typeform-address-wrap :deep(.absolute > div:last-child) {
  border-bottom: none;
}
.typeform-address-wrap :deep(.absolute > div:hover) {
  background-color: #fff7ed;
  color: #111827;
}

/* Fade transition for enter hint */
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.25s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

/* Slide transitions */
.slide-up-enter-active,
.slide-up-leave-active,
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.35s ease;
}

.slide-up-enter-from {
  opacity: 0;
  transform: translateY(30px);
}
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(-30px);
}

.slide-down-enter-from {
  opacity: 0;
  transform: translateY(-30px);
}
.slide-down-leave-to {
  opacity: 0;
  transform: translateY(30px);
}
</style>
