<template>
  <Teleport to="body">
    <div
      v-if="show"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4"
    >
      <div class="bg-white dark:bg-slate-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto border-2 border-[#3DDBB3]/30">
        <!-- TDS Branded Header -->
        <div class="px-6 py-4 border-b border-[#3DDBB3]/30 sticky top-0 bg-gradient-to-r from-[#3DDBB3]/10 to-[#1E3A8A]/5 dark:from-[#3DDBB3]/20 dark:to-[#1E3A8A]/10">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="flex items-center justify-center w-10 h-10 rounded-full bg-[#3DDBB3]">
                <div class="w-3 h-3 rounded-full bg-[#1E3A8A]"></div>
              </div>
              <div>
                <h3 class="text-lg font-bold text-[#1E3A8A] dark:text-white">Register with TDS</h3>
                <p class="text-xs text-gray-500 dark:text-slate-400">{{ schemeLabel }} Scheme</p>
              </div>
            </div>
            <button @click="handleClose" :disabled="isSubmitting" class="text-gray-400 hover:text-[#1E3A8A] dark:text-slate-400 dark:hover:text-[#3DDBB3]">
              <X class="w-5 h-5" />
            </button>
          </div>
        </div>

        <!-- Success State -->
        <div v-if="registrationComplete" class="p-6">
          <div class="text-center py-8">
            <div class="w-16 h-16 bg-[#3DDBB3]/20 dark:bg-[#3DDBB3]/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle class="w-8 h-8 text-[#3DDBB3]" />
            </div>
            <h4 class="text-xl font-semibold text-[#1E3A8A] dark:text-white mb-2">Deposit Protected</h4>
            <p class="text-gray-600 dark:text-slate-400 mb-4">
              The deposit has been registered with TDS {{ schemeLabel }}.
            </p>
            <div class="bg-[#3DDBB3]/10 dark:bg-[#3DDBB3]/20 border border-[#3DDBB3]/30 rounded-lg p-4 inline-block">
              <p class="text-sm text-gray-500 dark:text-slate-400">Deposit Assurance Number (DAN)</p>
              <p class="text-2xl font-mono font-bold text-[#1E3A8A] dark:text-[#3DDBB3]">{{ registrationDAN }}</p>
            </div>
            <p class="text-sm text-gray-500 dark:text-slate-400 mt-4">
              TDS will contact the tenant by email with deposit protection details.
            </p>
          </div>
          <div class="flex justify-center gap-3 pt-4 border-t border-[#3DDBB3]/30">
            <button
              @click="handleDownloadDPC"
              :disabled="downloadingDPC"
              class="px-4 py-2 text-sm font-medium text-[#1E3A8A] border border-[#3DDBB3] hover:bg-[#3DDBB3]/10 dark:text-[#3DDBB3] dark:hover:bg-[#3DDBB3]/20 rounded-lg flex items-center gap-2"
            >
              <Download class="w-4 h-4" />
              {{ downloadingDPC ? 'Downloading...' : 'Download Certificate' }}
            </button>
            <button
              @click="handleClose"
              class="px-4 py-2 text-sm font-medium text-white bg-[#1E3A8A] hover:bg-[#1E3A8A]/90 rounded-lg"
            >
              Done
            </button>
          </div>
        </div>

        <!-- Pending State -->
        <div v-else-if="registrationPending" class="p-6">
          <div class="text-center py-8">
            <div class="w-16 h-16 bg-amber-100 dark:bg-amber-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle class="w-8 h-8 text-amber-600 dark:text-amber-400" />
            </div>
            <h4 class="text-xl font-semibold text-[#1E3A8A] dark:text-white mb-2">Registration Pending</h4>
            <p class="text-gray-600 dark:text-slate-400 mb-4">
              TDS is taking longer than expected to process this deposit. Your registration has been saved and will complete automatically.
            </p>
            <div class="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg p-4 text-left mb-4">
              <p class="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">What happens next?</p>
              <ul class="text-sm text-amber-700 dark:text-amber-300 space-y-1 list-disc list-inside">
                <li>TDS will continue processing in the background</li>
                <li>Once complete, the DAN will appear on this tenancy</li>
                <li>You can check the TDS portal for immediate status</li>
              </ul>
            </div>
            <div class="bg-[#3DDBB3]/10 dark:bg-[#3DDBB3]/20 border border-[#3DDBB3]/30 rounded-lg p-4 inline-block">
              <p class="text-sm text-gray-500 dark:text-slate-400">Batch Reference</p>
              <p class="text-lg font-mono font-bold text-[#1E3A8A] dark:text-[#3DDBB3]">{{ pendingBatchId }}</p>
            </div>
          </div>
          <div class="flex justify-center gap-3 pt-4 border-t border-[#3DDBB3]/30">
            <a
              href="https://www.tenancydepositscheme.com"
              target="_blank"
              class="px-4 py-2 text-sm font-medium text-[#1E3A8A] border border-[#3DDBB3] hover:bg-[#3DDBB3]/10 dark:text-[#3DDBB3] dark:hover:bg-[#3DDBB3]/20 rounded-lg flex items-center gap-2"
            >
              Open TDS Portal
            </a>
            <button
              @click="handleClose"
              class="px-4 py-2 text-sm font-medium text-white bg-[#1E3A8A] hover:bg-[#1E3A8A]/90 rounded-lg"
            >
              Close
            </button>
          </div>
        </div>

        <!-- Form State -->
        <div v-else class="p-6">
          <!-- Property Section -->
          <div class="mb-6">
            <div class="flex items-center justify-between mb-2">
              <h4 class="text-sm font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider">Property</h4>
              <button
                @click="editingSections.property = !editingSections.property"
                class="text-xs text-primary hover:underline"
              >
                {{ editingSections.property ? 'Done' : 'Edit' }}
              </button>
            </div>
            <div v-if="editingSections.property" class="space-y-3 bg-gray-50 dark:bg-slate-800 p-4 rounded-lg">
              <div class="relative overflow-visible">
                <AddressAutocomplete
                  v-model="formData.property.addressLine1"
                  label="Address Line 1"
                  id="tds-property-address"
                  placeholder="Start typing address..."
                  @addressSelected="handleTDSPropertyAddressSelected"
                  :allowManualEntry="true"
                />
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">City/Town</label>
                  <input v-model="formData.property.city" type="text" class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded-lg text-sm" />
                </div>
                <div>
                  <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">County</label>
                  <input v-model="formData.property.county" type="text" class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">Postcode</label>
                <input v-model="formData.property.postcode" type="text" class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded-lg text-sm max-w-[150px]" />
              </div>
            </div>
            <div v-else class="bg-gray-50 dark:bg-slate-800 p-3 rounded-lg">
              <p class="text-sm text-gray-900 dark:text-white">{{ formData.property.addressLine1 }}</p>
              <p class="text-sm text-gray-600 dark:text-slate-400">{{ formData.property.city }}, {{ formData.property.county }} {{ formData.property.postcode }}</p>
            </div>
          </div>

          <!-- Tenancy Section -->
          <div class="mb-6">
            <div class="flex items-center justify-between mb-2">
              <h4 class="text-sm font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider">Tenancy</h4>
              <button
                @click="editingSections.tenancy = !editingSections.tenancy"
                class="text-xs text-primary hover:underline"
              >
                {{ editingSections.tenancy ? 'Done' : 'Edit' }}
              </button>
            </div>
            <div v-if="editingSections.tenancy" class="space-y-3 bg-gray-50 dark:bg-slate-800 p-4 rounded-lg">
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">Start Date *</label>
                  <input v-model="formData.tenancy.startDate" type="date" required class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded-lg text-sm" />
                </div>
                <div>
                  <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">End Date (optional)</label>
                  <input v-model="formData.tenancy.endDate" type="date" class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">Monthly Rent</label>
                <div class="flex items-center">
                  <span class="text-gray-500 dark:text-slate-400 mr-1">&pound;</span>
                  <input v-model="formData.tenancy.rent" type="number" step="0.01" class="w-32 px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded-lg text-sm" />
                </div>
              </div>
            </div>
            <div v-else class="bg-gray-50 dark:bg-slate-800 p-3 rounded-lg">
              <div class="flex gap-6 text-sm">
                <div>
                  <span class="text-gray-500 dark:text-slate-400">Start:</span>
                  <span class="ml-1 text-gray-900 dark:text-white">{{ formatDisplayDate(formData.tenancy.startDate) }}</span>
                </div>
                <div>
                  <span class="text-gray-500 dark:text-slate-400">End:</span>
                  <span class="ml-1 text-gray-900 dark:text-white">{{ formData.tenancy.endDate ? formatDisplayDate(formData.tenancy.endDate) : 'Periodic' }}</span>
                </div>
                <div>
                  <span class="text-gray-500 dark:text-slate-400">Rent:</span>
                  <span class="ml-1 text-gray-900 dark:text-white">&pound;{{ Number(formData.tenancy.rent).toLocaleString() }}/month</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Deposit Section -->
          <div class="mb-6">
            <div class="flex items-center justify-between mb-2">
              <h4 class="text-sm font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider">Deposit</h4>
              <button
                @click="editingSections.deposit = !editingSections.deposit"
                class="text-xs text-primary hover:underline"
              >
                {{ editingSections.deposit ? 'Done' : 'Edit' }}
              </button>
            </div>
            <div v-if="editingSections.deposit" class="space-y-3 bg-gray-50 dark:bg-slate-800 p-4 rounded-lg">
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">Deposit Amount *</label>
                  <div class="flex items-center">
                    <span class="text-gray-500 dark:text-slate-400 mr-1">&pound;</span>
                    <input v-model="formData.deposit.amount" type="number" step="0.01" required class="w-32 px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded-lg text-sm" />
                  </div>
                </div>
                <div>
                  <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">Amount to Protect</label>
                  <div class="flex items-center">
                    <span class="text-gray-500 dark:text-slate-400 mr-1">&pound;</span>
                    <input v-model="formData.deposit.amountToProtect" type="number" step="0.01" class="w-32 px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded-lg text-sm" />
                  </div>
                </div>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">Received Date *</label>
                  <input v-model="formData.deposit.receivedDate" type="date" required class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded-lg text-sm" />
                </div>
                <div>
                  <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">Furnished Status</label>
                  <select v-model="formData.deposit.furnished" class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded-lg text-sm">
                    <option value="furnished">Furnished</option>
                    <option value="unfurnished">Unfurnished</option>
                    <option value="part_furnished">Part Furnished</option>
                  </select>
                </div>
              </div>
            </div>
            <div v-else class="bg-gray-50 dark:bg-slate-800 p-3 rounded-lg">
              <div class="flex gap-6 text-sm">
                <div>
                  <span class="text-gray-500 dark:text-slate-400">Amount:</span>
                  <span class="ml-1 text-gray-900 dark:text-white font-semibold">&pound;{{ Number(formData.deposit.amount).toLocaleString() }}</span>
                </div>
                <div>
                  <span class="text-gray-500 dark:text-slate-400">Received:</span>
                  <span class="ml-1 text-gray-900 dark:text-white">{{ formatDisplayDate(formData.deposit.receivedDate!) }}</span>
                </div>
                <div>
                  <span class="text-gray-500 dark:text-slate-400">Furnished:</span>
                  <span class="ml-1 text-gray-900 dark:text-white">{{ furnishedLabel }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Landlord Section -->
          <div class="mb-6">
            <div class="flex items-center justify-between mb-2">
              <h4 class="text-sm font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider">Landlord</h4>
              <button
                @click="editingSections.landlord = !editingSections.landlord"
                class="text-xs text-primary hover:underline"
              >
                {{ editingSections.landlord ? 'Done' : 'Edit' }}
              </button>
            </div>
            <div v-if="editingSections.landlord" class="space-y-3 bg-gray-50 dark:bg-slate-800 p-4 rounded-lg">
              <div class="grid grid-cols-3 gap-3">
                <div>
                  <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">Title</label>
                  <select v-model="formData.landlord.title" class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded-lg text-sm">
                    <option value="Mr">Mr</option>
                    <option value="Mrs">Mrs</option>
                    <option value="Ms">Ms</option>
                    <option value="Miss">Miss</option>
                    <option value="Dr">Dr</option>
                  </select>
                </div>
                <div>
                  <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">First Name *</label>
                  <input v-model="formData.landlord.firstName" type="text" required class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded-lg text-sm" />
                </div>
                <div>
                  <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">Last Name *</label>
                  <input v-model="formData.landlord.lastName" type="text" required class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">Email *</label>
                <input v-model="formData.landlord.email" type="email" required class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded-lg text-sm" />
              </div>
              <div>
                <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">Address</label>
                <input v-model="formData.landlord.address" type="text" class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded-lg text-sm" placeholder="Full address" />
              </div>
            </div>
            <div v-else class="bg-gray-50 dark:bg-slate-800 p-3 rounded-lg">
              <p class="text-sm text-gray-900 dark:text-white">{{ formData.landlord.title }} {{ formData.landlord.firstName }} {{ formData.landlord.lastName }}</p>
              <p class="text-sm text-gray-600 dark:text-slate-400">{{ formData.landlord.email }}</p>
              <p v-if="formData.landlord.address" class="text-sm text-gray-500 dark:text-slate-400">{{ formData.landlord.address }}</p>
            </div>
          </div>

          <!-- Tenants Section -->
          <div class="mb-6">
            <div class="flex items-center justify-between mb-2">
              <h4 class="text-sm font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider">
                Tenants ({{ formData.tenants.length }})
              </h4>
              <button
                @click="editingSections.tenants = !editingSections.tenants"
                class="text-xs text-primary hover:underline"
              >
                {{ editingSections.tenants ? 'Done' : 'Edit' }}
              </button>
            </div>
            <div v-if="editingSections.tenants" class="space-y-3">
              <div
                v-for="(tenant, index) in formData.tenants"
                :key="index"
                class="bg-gray-50 dark:bg-slate-800 p-4 rounded-lg"
              >
                <div class="flex items-center justify-between mb-2">
                  <span class="text-xs font-medium text-gray-600 dark:text-slate-400">
                    {{ tenant.isLead ? 'Lead Tenant' : `Joint Tenant ${index}` }}
                  </span>
                </div>
                <div class="grid grid-cols-3 gap-3 mb-2">
                  <div>
                    <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">Title</label>
                    <select v-model="tenant.title" class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded-lg text-sm">
                      <option value="Mr">Mr</option>
                      <option value="Mrs">Mrs</option>
                      <option value="Ms">Ms</option>
                      <option value="Miss">Miss</option>
                      <option value="Dr">Dr</option>
                    </select>
                  </div>
                  <div>
                    <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">First Name *</label>
                    <input v-model="tenant.firstName" type="text" required class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded-lg text-sm" />
                  </div>
                  <div>
                    <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">Last Name *</label>
                    <input v-model="tenant.lastName" type="text" required class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded-lg text-sm" />
                  </div>
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">Email {{ tenant.isLead ? '*' : '' }}</label>
                    <input v-model="tenant.email" type="email" :required="tenant.isLead" class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded-lg text-sm" />
                  </div>
                  <div>
                    <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">Phone</label>
                    <input v-model="tenant.phone" type="tel" class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded-lg text-sm" />
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="space-y-2">
              <div
                v-for="(tenant, index) in formData.tenants"
                :key="index"
                class="bg-gray-50 dark:bg-slate-800 p-3 rounded-lg flex items-center justify-between"
              >
                <div>
                  <p class="text-sm text-gray-900 dark:text-white">
                    {{ tenant.title }} {{ tenant.firstName }} {{ tenant.lastName }}
                    <span v-if="tenant.isLead" class="text-xs text-primary ml-1">(Lead)</span>
                  </p>
                  <p class="text-sm text-gray-600 dark:text-slate-400">{{ tenant.email }}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Warning -->
          <div class="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg p-4 mb-6">
            <div class="flex gap-3">
              <AlertTriangle class="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div class="text-sm text-amber-800 dark:text-amber-200">
                <p class="font-medium">Important</p>
                <p>TDS will contact the tenant by email once the deposit is registered. Please ensure all details are correct before submitting.</p>
              </div>
            </div>
          </div>

          <!-- Validation Errors -->
          <div v-if="validationErrors.length > 0" class="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg p-4 mb-6">
            <h5 class="text-sm font-medium text-red-800 dark:text-red-200 mb-2">Please fix the following:</h5>
            <ul class="list-disc list-inside text-sm text-red-700 dark:text-red-300 space-y-1">
              <li v-for="error in validationErrors" :key="error">{{ error }}</li>
            </ul>
          </div>

          <!-- Error Message -->
          <div v-if="errorMessage" class="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg p-4 mb-6">
            <p class="text-sm text-red-700 dark:text-red-300">{{ errorMessage }}</p>
          </div>

          <!-- Submitting State -->
          <div v-if="isSubmitting" class="mb-6">
            <div class="bg-[#3DDBB3]/10 dark:bg-[#3DDBB3]/20 border border-[#3DDBB3]/30 rounded-lg p-4">
              <div class="flex items-center gap-3">
                <Loader2 class="w-5 h-5 text-[#3DDBB3] animate-spin" />
                <div>
                  <p class="text-sm font-medium text-[#1E3A8A] dark:text-white">{{ submittingStatus }}</p>
                  <p class="text-xs text-gray-500 dark:text-slate-400">Please wait...</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div v-if="!registrationComplete && !registrationPending" class="px-6 py-4 border-t border-[#3DDBB3]/30 flex justify-end gap-3 sticky bottom-0 bg-white dark:bg-slate-900">
          <button
            type="button"
            @click="handleClose"
            :disabled="isSubmitting"
            class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            @click="handleSubmit"
            :disabled="isSubmitting || !isFormValid"
            class="px-4 py-2 text-sm font-medium text-white bg-[#1E3A8A] hover:bg-[#1E3A8A]/90 rounded-lg disabled:opacity-50 flex items-center gap-2"
          >
            <Loader2 v-if="isSubmitting" class="w-4 h-4 animate-spin" />
            {{ isSubmitting ? 'Registering...' : 'Confirm & Register' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useToast } from 'vue-toastification'
import { useAuthStore } from '@/stores/auth'
import {
  X, CheckCircle, AlertTriangle, Loader2, Download
} from 'lucide-vue-next'
import { API_URL } from '@/lib/apiUrl'
import { authFetch } from '@/lib/authFetch'
import AddressAutocomplete from '@/components/AddressAutocomplete.vue'

const props = defineProps<{
  show: boolean
  tenancy: any | null
  schemeType?: 'custodial' | 'insured'
  landlords?: any[]
}>()

// Computed scheme label
const schemeLabel = computed(() => props.schemeType === 'insured' ? 'Insured' : 'Custodial')

const emit = defineEmits<{
  close: []
  registered: [dan: string]
  pending: [batchId: string]
}>()

const toast = useToast()
const authStore = useAuthStore()

// Reset state when modal opens
watch(() => props.show, (newVal) => {
  if (newVal) {
    console.log('[RegisterDepositWithTDSModal] Modal opened for tenancy:', props.tenancy?.id)
  }
}, { immediate: true })

// State
const isSubmitting = ref(false)
const submittingStatus = ref('')
const errorMessage = ref('')
const validationErrors = ref<string[]>([])
const registrationComplete = ref(false)
const registrationPending = ref(false)
const pendingBatchId = ref('')
const registrationDAN = ref('')
const registrationSchemeType = ref<'custodial' | 'insured'>('custodial')
const downloadingDPC = ref(false)

const editingSections = ref({
  property: false,
  tenancy: false,
  deposit: false,
  landlord: false,
  tenants: false
})

interface TenantForm {
  title: string
  firstName: string
  lastName: string
  email: string
  phone: string
  isLead: boolean
}

const formData = ref({
  property: {
    addressLine1: '',
    addressLine2: '',
    city: '',
    county: '',
    postcode: ''
  },
  tenancy: {
    startDate: '',
    endDate: '',
    rent: 0
  },
  deposit: {
    amount: 0,
    amountToProtect: 0,
    receivedDate: new Date().toISOString().split('T')[0],
    furnished: 'furnished'
  },
  landlord: {
    title: 'Mr',
    firstName: '',
    lastName: '',
    email: '',
    address: ''
  },
  tenants: [] as TenantForm[]
})

// Computed
const isFormValid = computed(() => {
  return (
    formData.value.property.addressLine1 &&
    formData.value.property.city &&
    formData.value.property.postcode &&
    formData.value.tenancy.startDate &&
    formData.value.deposit.amount > 0 &&
    formData.value.deposit.receivedDate &&
    formData.value.landlord.firstName &&
    formData.value.landlord.lastName &&
    formData.value.landlord.email &&
    formData.value.tenants.length > 0 &&
    formData.value.tenants[0]!.firstName &&
    formData.value.tenants[0]!.lastName &&
    (formData.value.tenants[0]!.email || formData.value.tenants[0]!.phone)
  )
})

const furnishedLabel = computed(() => {
  const labels: Record<string, string> = {
    furnished: 'Furnished',
    unfurnished: 'Unfurnished',
    part_furnished: 'Part Furnished'
  }
  return labels[formData.value.deposit.furnished] || 'Furnished'
})

// Methods
const formatDisplayDate = (dateStr: string): string => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function handleTDSPropertyAddressSelected(data: { addressLine1: string; addressLine2?: string; city: string; postcode: string; country?: string }) {
  formData.value.property.addressLine1 = data.addressLine1
  formData.value.property.city = data.city
  formData.value.property.postcode = data.postcode
}

const populateFormFromTenancy = () => {
  if (!props.tenancy) return

  const t = props.tenancy
  const p = t.property || {}

  // Property
  formData.value.property = {
    addressLine1: p.address_line1 || '',
    addressLine2: p.address_line2 || '',
    city: p.city || '',
    county: p.county || '',
    postcode: p.postcode || ''
  }

  // Tenancy
  formData.value.tenancy = {
    startDate: t.tenancy_start_date || t.start_date || '',
    endDate: t.end_date || t.tenancy_end_date || '',
    rent: t.monthly_rent || 0
  }

  // Deposit
  formData.value.deposit = {
    amount: t.deposit_amount || 0,
    amountToProtect: t.deposit_amount || 0,
    receivedDate: new Date().toISOString().split('T')[0],
    furnished: 'furnished'
  }

  // Landlord - get from landlords prop (passed separately) or tenancy landlords
  const landlords = props.landlords || t.landlords || []
  const primaryLandlord = landlords.find((l: any) => l.is_primary || l.is_primary_contact) || landlords[0]

  if (primaryLandlord) {
    // Handle both formats: separate first_name/last_name or combined 'name' field
    let firstName = primaryLandlord.first_name || ''
    let lastName = primaryLandlord.last_name || ''

    // If we have a combined 'name' field but no first_name/last_name, parse it
    if (!firstName && !lastName && primaryLandlord.name) {
      const nameParts = primaryLandlord.name.trim().split(' ')
      firstName = nameParts[0] || ''
      lastName = nameParts.slice(1).join(' ') || ''
    }

    formData.value.landlord = {
      title: primaryLandlord.title || 'Mr',
      firstName,
      lastName,
      email: primaryLandlord.email || '',
      address: [
        primaryLandlord.address_line1,
        primaryLandlord.city,
        primaryLandlord.postcode
      ].filter(Boolean).join(', '),
      addressLine1: primaryLandlord.address_line1 || '',
      city: primaryLandlord.city || '',
      postcode: primaryLandlord.postcode || ''
    }
  }

  // Tenants
  const tenants = t.tenants || []
  formData.value.tenants = tenants.map((tenant: any, index: number) => ({
    title: tenant.title || 'Mr',
    firstName: tenant.first_name || '',
    lastName: tenant.last_name || '',
    email: tenant.email || '',
    phone: tenant.phone || '',
    isLead: tenant.is_lead || index === 0
  }))

  // Ensure at least one tenant
  if (formData.value.tenants.length === 0) {
    formData.value.tenants.push({
      title: 'Mr',
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      isLead: true
    })
  }
}

const validateForm = (): boolean => {
  validationErrors.value = []

  // Property validation
  if (!formData.value.property.addressLine1) {
    validationErrors.value.push('Property address line 1 is required')
  }
  if (!formData.value.property.city) {
    validationErrors.value.push('Property city/town is required')
  }
  if (!formData.value.property.postcode) {
    validationErrors.value.push('Property postcode is required')
  }

  // Tenancy validation
  if (!formData.value.tenancy.startDate) {
    validationErrors.value.push('Tenancy start date is required')
  }

  // Deposit validation
  if (!formData.value.deposit.amount || formData.value.deposit.amount <= 0) {
    validationErrors.value.push('Deposit amount must be greater than 0')
  }
  if (!formData.value.deposit.receivedDate) {
    validationErrors.value.push('Deposit received date is required')
  }

  // Landlord validation
  if (!formData.value.landlord.firstName) {
    validationErrors.value.push('Landlord first name is required')
  }
  if (!formData.value.landlord.lastName) {
    validationErrors.value.push('Landlord last name is required')
  }
  if (!formData.value.landlord.email) {
    validationErrors.value.push('Landlord email is required')
  }

  // Lead tenant validation
  const leadTenant = formData.value.tenants.find(t => t.isLead) || formData.value.tenants[0]
  if (!leadTenant) {
    validationErrors.value.push('At least one tenant is required')
  } else {
    if (!leadTenant.firstName) {
      validationErrors.value.push('Lead tenant first name is required')
    }
    if (!leadTenant.lastName) {
      validationErrors.value.push('Lead tenant last name is required')
    }
    if (!leadTenant.email && !leadTenant.phone) {
      validationErrors.value.push('Lead tenant email or phone is required')
    }
  }

  return validationErrors.value.length === 0
}

const handleSubmit = async () => {
  console.log('[RegisterDepositWithTDSModal] handleSubmit called')
  toast.info('Submitting to TDS...')

  if (!validateForm()) {
    console.log('[RegisterDepositWithTDSModal] Form validation failed:', validationErrors.value)
    toast.error('Please fix form errors: ' + validationErrors.value.join(', '))
    return
  }
  if (!props.tenancy) {
    console.log('[RegisterDepositWithTDSModal] No tenancy provided')
    toast.error('No tenancy data available')
    return
  }

  isSubmitting.value = true
  errorMessage.value = ''
  submittingStatus.value = 'Submitting to TDS...'
  console.log('[RegisterDepositWithTDSModal] Starting API call to TDS...')

  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    // Determine which endpoint to use based on scheme type
    const schemeType = props.schemeType || 'custodial'
    const createEndpoint = schemeType === 'insured'
      ? `${API_URL}/api/tds/insured/create-deposit`
      : `${API_URL}/api/tds/custodial/create-deposit`

    // Create deposit
    console.log('[RegisterDepositWithTDSModal] Calling:', createEndpoint)
    console.log('[RegisterDepositWithTDSModal] Payload:', {
      tenancyId: props.tenancy.id,
      depositReceivedDate: formData.value.deposit.receivedDate,
      furnishedStatus: formData.value.deposit.furnished
    })

    // Send ALL form data - don't rely on backend to pull from linked tables
    const createResponse = await authFetch(createEndpoint, {
      method: 'POST',
      token,
      body: JSON.stringify({
        tenancyId: props.tenancy.id,
        depositReceivedDate: formData.value.deposit.receivedDate,
        furnishedStatus: formData.value.deposit.furnished,
        // Send the actual form data
        property: formData.value.property,
        tenancy: formData.value.tenancy,
        deposit: formData.value.deposit,
        landlord: formData.value.landlord,
        tenants: formData.value.tenants
      })
    })

    console.log('[RegisterDepositWithTDSModal] Response status:', createResponse.status)

    // Handle non-JSON responses gracefully
    let createData: any
    const contentType = createResponse.headers.get('content-type')
    if (contentType && contentType.includes('application/json')) {
      try {
        createData = await createResponse.json()
      } catch (parseError) {
        console.error('Failed to parse response:', parseError)
        throw new Error(`Server error: ${createResponse.status} - Invalid response format`)
      }
    } else {
      const text = await createResponse.text()
      console.error('Non-JSON response:', text)
      throw new Error(`Server error: ${createResponse.status} - ${text || 'Unknown error'}`)
    }

    if (!createResponse.ok || !createData.success) {
      throw new Error(createData.error || 'Failed to submit deposit to TDS')
    }

    // For Insured, we use apiReference; for Custodial, we use batchId
    const referenceId = createData.apiReference || createData.batchId

    // Show pending state in modal with the batch reference
    pendingBatchId.value = referenceId
    registrationPending.value = true
    isSubmitting.value = false
    submittingStatus.value = ''

    // Emit pending event so drawer starts polling, but don't close modal yet
    emit('pending', referenceId)
    toast.success('Deposit submitted to TDS successfully!')

    // The modal will stay open showing pending state - user can click Close when ready
  } catch (err: any) {
    console.error('TDS registration error:', err)
    errorMessage.value = err.message || 'Failed to register deposit'
    toast.error(err.message || 'Registration failed')
    isSubmitting.value = false
    submittingStatus.value = ''
  }
}

const handleDownloadDPC = async () => {
  if (!registrationDAN.value) return

  downloadingDPC.value = true

  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    // Use unified certificate endpoint
    const response = await authFetch(`${API_URL}/api/tds/certificate/${registrationDAN.value}`, {
      token
    })

    if (!response.ok) {
      throw new Error('Failed to download certificate')
    }

    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const filePrefix = registrationSchemeType.value === 'insured' ? 'Certificate' : 'DPC'
    a.download = `${filePrefix}-${registrationDAN.value}.pdf`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)

    toast.success('Certificate downloaded')
  } catch (err: any) {
    console.error('Error downloading certificate:', err)
    toast.error(err.message || 'Failed to download certificate')
  } finally {
    downloadingDPC.value = false
  }
}

const handleClose = () => {
  if (isSubmitting.value) return
  emit('close')
}

// Watch for modal open
watch(() => props.show, (isShow) => {
  if (isShow) {
    // Reset state
    registrationComplete.value = false
    registrationPending.value = false
    pendingBatchId.value = ''
    registrationDAN.value = ''
    errorMessage.value = ''
    validationErrors.value = []
    isSubmitting.value = false
    Object.keys(editingSections.value).forEach(key => {
      editingSections.value[key as keyof typeof editingSections.value] = false
    })

    // Populate form
    populateFormFromTenancy()
  }
})
</script>
