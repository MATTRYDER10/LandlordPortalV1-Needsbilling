<template>
  <Teleport to="body">
    <div
      v-if="show"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      @click.self="handleClose"
    >
      <div class="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        <!-- Header -->
        <div class="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-slate-50 to-white">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                <Scale class="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <h3 class="text-lg font-semibold text-gray-900">Section 48 Notice</h3>
                <p class="text-sm text-gray-500">Address for Service of Notices</p>
              </div>
            </div>
            <button
              @click="handleClose"
              class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X class="w-5 h-5" />
            </button>
          </div>
        </div>

        <!-- Step Indicator -->
        <div class="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div class="flex items-center justify-between max-w-xl mx-auto">
            <template v-for="(step, index) in steps" :key="step.id">
              <div class="flex items-center">
                <div
                  class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-200"
                  :class="getStepClass(index + 1)"
                >
                  <Check v-if="formState.currentStep > index + 1" class="w-4 h-4" />
                  <span v-else>{{ index + 1 }}</span>
                </div>
                <span
                  class="ml-2 text-sm font-medium hidden sm:inline transition-colors"
                  :class="formState.currentStep >= index + 1 ? 'text-gray-900' : 'text-gray-400'"
                >
                  {{ step.label }}
                </span>
              </div>
              <div
                v-if="index < steps.length - 1"
                class="flex-1 h-0.5 mx-3 transition-colors duration-200"
                :class="formState.currentStep > index + 1 ? 'bg-primary' : 'bg-gray-200'"
              />
            </template>
          </div>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto p-6">
          <!-- Loading State -->
          <div v-if="formState.isLoading" class="flex items-center justify-center py-12">
            <Loader2 class="w-8 h-8 text-primary animate-spin" />
            <span class="ml-3 text-gray-600">Loading tenancy data...</span>
          </div>

          <!-- Step 1: Address for Service -->
          <div v-else-if="formState.currentStep === 1" class="space-y-6">
            <div>
              <h4 class="text-base font-semibold text-gray-900 mb-1">Address for Service of Notices</h4>
              <p class="text-sm text-gray-500">
                Under Section 48 of the Landlord and Tenant Act 1987, you must provide the tenant with an address in England or Wales where notices may be served on the landlord.
              </p>
            </div>

            <!-- Address Options -->
            <div class="space-y-3">
              <label class="text-sm font-medium text-gray-700 dark:text-slate-200">Select the address for service:</label>

              <!-- Agent Address -->
              <div
                @click="selectAddressType('agent')"
                class="border-2 rounded-lg p-4 cursor-pointer transition-all"
                :class="formState.addressForServiceType === 'agent'
                  ? 'border-primary bg-primary/5'
                  : 'border-gray-200 hover:border-gray-300'"
              >
                <div class="flex items-start gap-3">
                  <div
                    class="w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 flex-shrink-0"
                    :class="formState.addressForServiceType === 'agent'
                      ? 'border-primary'
                      : 'border-gray-300'"
                  >
                    <div
                      v-if="formState.addressForServiceType === 'agent'"
                      class="w-2.5 h-2.5 rounded-full bg-primary"
                    />
                  </div>
                  <div class="flex-1">
                    <p class="font-medium text-gray-900">{{ agentName }} (Agent)</p>
                    <p class="text-sm text-gray-600">{{ formatAddress(agentAddress) }}</p>
                    <p class="text-xs text-primary mt-1 flex items-center gap-1">
                      <CheckCircle class="w-3 h-3" />
                      Recommended for managed tenancies
                    </p>
                  </div>
                </div>
              </div>

              <!-- Landlord Address -->
              <div
                @click="selectAddressType('landlord')"
                class="border-2 rounded-lg p-4 cursor-pointer transition-all"
                :class="formState.addressForServiceType === 'landlord'
                  ? 'border-primary bg-primary/5'
                  : 'border-gray-200 hover:border-gray-300'"
              >
                <div class="flex items-start gap-3">
                  <div
                    class="w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 flex-shrink-0"
                    :class="formState.addressForServiceType === 'landlord'
                      ? 'border-primary'
                      : 'border-gray-300'"
                  >
                    <div
                      v-if="formState.addressForServiceType === 'landlord'"
                      class="w-2.5 h-2.5 rounded-full bg-primary"
                    />
                  </div>
                  <div class="flex-1">
                    <p class="font-medium text-gray-900">Landlord's Address</p>
                    <p v-if="hasLandlordAddress" class="text-sm text-gray-600">
                      {{ formatAddress(formState.landlordAddress) }}
                    </p>
                    <p v-else class="text-sm text-amber-600">
                      No landlord address on record — enter in Step 2
                    </p>
                    <p class="text-xs text-gray-500 mt-1">Use if landlord manages directly</p>
                  </div>
                </div>
              </div>

              <!-- Other Address -->
              <div
                @click="selectAddressType('other')"
                class="border-2 rounded-lg p-4 cursor-pointer transition-all"
                :class="formState.addressForServiceType === 'other'
                  ? 'border-primary bg-primary/5'
                  : 'border-gray-200 hover:border-gray-300'"
              >
                <div class="flex items-start gap-3">
                  <div
                    class="w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 flex-shrink-0"
                    :class="formState.addressForServiceType === 'other'
                      ? 'border-primary'
                      : 'border-gray-300'"
                  >
                    <div
                      v-if="formState.addressForServiceType === 'other'"
                      class="w-2.5 h-2.5 rounded-full bg-primary"
                    />
                  </div>
                  <div class="flex-1">
                    <p class="font-medium text-gray-900">Other Address</p>
                    <p class="text-xs text-gray-500 mb-3">e.g. solicitor's office or alternative agent address</p>

                    <div v-if="formState.addressForServiceType === 'other'" class="space-y-3">
                      <div>
                        <label class="block text-xs text-gray-500 mb-1">Name (who notices should be addressed to)</label>
                        <input
                          v-model="formState.addressForServiceName"
                          type="text"
                          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                          placeholder="e.g. Smith & Co Solicitors"
                        />
                      </div>
                      <div>
                        <label class="block text-xs text-gray-500 mb-1">Address Line 1 *</label>
                        <input
                          v-model="formState.addressForService.line1"
                          type="text"
                          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                          placeholder="Street address"
                        />
                      </div>
                      <div>
                        <label class="block text-xs text-gray-500 mb-1">Address Line 2</label>
                        <input
                          v-model="formState.addressForService.line2"
                          type="text"
                          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                          placeholder="Building, floor, etc."
                        />
                      </div>
                      <div class="grid grid-cols-2 gap-3">
                        <div>
                          <label class="block text-xs text-gray-500 mb-1">Town/City *</label>
                          <input
                            v-model="formState.addressForService.city"
                            type="text"
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                          />
                        </div>
                        <div>
                          <label class="block text-xs text-gray-500 mb-1">County</label>
                          <input
                            v-model="formState.addressForService.county"
                            type="text"
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                          />
                        </div>
                      </div>
                      <div class="w-1/2">
                        <label class="block text-xs text-gray-500 mb-1">Postcode *</label>
                        <input
                          v-model="formState.addressForService.postcode"
                          type="text"
                          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary uppercase"
                          placeholder="e.g. BS1 1AA"
                        />
                      </div>

                      <!-- Validation warnings -->
                      <div v-if="otherAddressWarnings.length > 0" class="space-y-2">
                        <div
                          v-for="warning in otherAddressWarnings"
                          :key="warning"
                          class="flex items-start gap-2 text-sm text-amber-600 bg-amber-50 p-2 rounded"
                        >
                          <AlertTriangle class="w-4 h-4 flex-shrink-0 mt-0.5" />
                          <span>{{ warning }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Reason for Serving -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Why is this notice being served? <span class="text-gray-400">(optional)</span>
              </label>
              <select
                v-model="formState.reasonForServing"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="first_service">First service — address not previously provided</option>
                <option value="address_changed">Address has changed — landlord/agent has moved</option>
                <option value="change_of_agent">Change of managing agent</option>
                <option value="precautionary">Precautionary re-service before legal proceedings</option>
                <option value="other">Other</option>
              </select>
              <input
                v-if="formState.reasonForServing === 'other'"
                v-model="formState.reasonForServingCustom"
                type="text"
                class="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="Please specify..."
              />
            </div>
          </div>

          <!-- Step 2: Landlord Details -->
          <div v-else-if="formState.currentStep === 2" class="space-y-6">
            <div>
              <h4 class="text-base font-semibold text-gray-900 mb-1">Landlord Details</h4>
              <p class="text-sm text-gray-500">
                Confirm the landlord details that will appear on the notice.
              </p>
            </div>

            <!-- Landlord Names -->
            <div>
              <div class="flex items-center justify-between mb-2">
                <label class="text-sm font-medium text-gray-700 dark:text-slate-200">Landlord Name(s) *</label>
                <button
                  v-if="!editingLandlordNames"
                  @click="editingLandlordNames = true"
                  class="text-xs text-primary hover:underline"
                >
                  Edit
                </button>
                <button
                  v-else
                  @click="editingLandlordNames = false"
                  class="text-xs text-primary hover:underline"
                >
                  Done
                </button>
              </div>

              <div v-if="!editingLandlordNames" class="bg-gray-50 rounded-lg p-3">
                <p v-for="(name, i) in formState.landlordNames" :key="i" class="text-sm text-gray-900">
                  {{ name }}
                </p>
                <p v-if="formState.landlordNames.length === 0" class="text-sm text-amber-600">
                  No landlord names on record
                </p>
              </div>

              <div v-else class="space-y-2">
                <div v-for="(name, i) in formState.landlordNames" :key="i" class="flex items-center gap-2">
                  <input
                    v-model="formState.landlordNames[i]"
                    type="text"
                    class="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    placeholder="Full name"
                  />
                  <button
                    @click="formState.landlordNames.splice(i, 1)"
                    class="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 class="w-4 h-4" />
                  </button>
                </div>
                <button
                  @click="formState.landlordNames.push('')"
                  class="flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  <Plus class="w-4 h-4" />
                  Add landlord
                </button>
              </div>
            </div>

            <!-- Company Landlord -->
            <div>
              <label class="flex items-center gap-3 cursor-pointer">
                <input
                  v-model="formState.isCompanyLandlord"
                  type="checkbox"
                  class="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span class="text-sm font-medium text-gray-700 dark:text-slate-200">Landlord is a company</span>
              </label>

              <div v-if="formState.isCompanyLandlord" class="mt-3 space-y-3 pl-7">
                <div>
                  <label class="block text-xs text-gray-500 mb-1">Company Registered Name *</label>
                  <input
                    v-model="formState.companyRegisteredName"
                    type="text"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    placeholder="e.g. ABC Properties Ltd"
                  />
                </div>
                <div>
                  <label class="block text-xs text-gray-500 mb-1">Company Registration Number</label>
                  <input
                    v-model="formState.companyRegistrationNumber"
                    type="text"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    placeholder="e.g. 12345678"
                  />
                </div>
              </div>
            </div>

            <!-- Landlord Address -->
            <div>
              <div class="flex items-center justify-between mb-2">
                <div>
                  <label class="text-sm font-medium text-gray-700 dark:text-slate-200">Landlord's Address</label>
                  <p class="text-xs text-gray-500">For identification purposes — may differ from the address for service</p>
                </div>
                <button
                  v-if="!editingLandlordAddress"
                  @click="editingLandlordAddress = true"
                  class="text-xs text-primary hover:underline"
                >
                  Edit
                </button>
                <button
                  v-else
                  @click="editingLandlordAddress = false"
                  class="text-xs text-primary hover:underline"
                >
                  Done
                </button>
              </div>

              <div v-if="!editingLandlordAddress" class="bg-gray-50 rounded-lg p-3">
                <p v-if="hasLandlordAddress" class="text-sm text-gray-900">
                  {{ formatAddress(formState.landlordAddress) }}
                </p>
                <p v-else class="text-sm text-amber-600">No address on record</p>
              </div>

              <div v-else class="space-y-3 bg-gray-50 rounded-lg p-4">
                <div>
                  <label class="block text-xs text-gray-500 mb-1">Address Line 1</label>
                  <input
                    v-model="formState.landlordAddress.line1"
                    type="text"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
                <div>
                  <label class="block text-xs text-gray-500 mb-1">Address Line 2</label>
                  <input
                    v-model="formState.landlordAddress.line2"
                    type="text"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label class="block text-xs text-gray-500 mb-1">Town/City</label>
                    <input
                      v-model="formState.landlordAddress.city"
                      type="text"
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                  <div>
                    <label class="block text-xs text-gray-500 mb-1">Postcode</label>
                    <input
                      v-model="formState.landlordAddress.postcode"
                      type="text"
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary uppercase"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Step 3: Tenant & Property -->
          <div v-else-if="formState.currentStep === 3" class="space-y-6">
            <div>
              <h4 class="text-base font-semibold text-gray-900 mb-1">Tenant & Property Details</h4>
              <p class="text-sm text-gray-500">
                Confirm the tenant and property details for the notice.
              </p>
            </div>

            <!-- Tenant Names -->
            <div>
              <div class="flex items-center justify-between mb-2">
                <label class="text-sm font-medium text-gray-700 dark:text-slate-200">Tenant Name(s) *</label>
                <button
                  v-if="!editingTenantNames"
                  @click="editingTenantNames = true"
                  class="text-xs text-primary hover:underline"
                >
                  Edit
                </button>
                <button
                  v-else
                  @click="editingTenantNames = false"
                  class="text-xs text-primary hover:underline"
                >
                  Done
                </button>
              </div>

              <div v-if="!editingTenantNames" class="bg-gray-50 rounded-lg p-3">
                <p v-for="(name, i) in formState.tenantNames" :key="i" class="text-sm text-gray-900">
                  {{ name }}
                </p>
                <p v-if="formState.tenantNames.length === 0" class="text-sm text-amber-600">
                  No tenants on record
                </p>
              </div>

              <div v-else class="space-y-2">
                <div v-for="(name, i) in formState.tenantNames" :key="i" class="flex items-center gap-2">
                  <input
                    v-model="formState.tenantNames[i]"
                    type="text"
                    class="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    placeholder="Full name"
                  />
                  <button
                    @click="formState.tenantNames.splice(i, 1)"
                    class="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 class="w-4 h-4" />
                  </button>
                </div>
                <button
                  @click="formState.tenantNames.push('')"
                  class="flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  <Plus class="w-4 h-4" />
                  Add tenant
                </button>
              </div>
            </div>

            <!-- Property Address -->
            <div>
              <div class="flex items-center justify-between mb-2">
                <label class="text-sm font-medium text-gray-700 dark:text-slate-200">Property Address *</label>
                <button
                  v-if="!editingPropertyAddress"
                  @click="editingPropertyAddress = true"
                  class="text-xs text-primary hover:underline"
                >
                  Edit
                </button>
                <button
                  v-else
                  @click="editingPropertyAddress = false"
                  class="text-xs text-primary hover:underline"
                >
                  Done
                </button>
              </div>

              <div v-if="!editingPropertyAddress" class="bg-gray-50 rounded-lg p-3">
                <p class="text-sm text-gray-900">{{ formatAddress(formState.propertyAddress) }}</p>
              </div>

              <div v-else class="space-y-3 bg-gray-50 rounded-lg p-4">
                <div>
                  <label class="block text-xs text-gray-500 mb-1">Address Line 1 *</label>
                  <input
                    v-model="formState.propertyAddress.line1"
                    type="text"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
                <div>
                  <label class="block text-xs text-gray-500 mb-1">Address Line 2</label>
                  <input
                    v-model="formState.propertyAddress.line2"
                    type="text"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label class="block text-xs text-gray-500 mb-1">Town/City *</label>
                    <input
                      v-model="formState.propertyAddress.city"
                      type="text"
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                  <div>
                    <label class="block text-xs text-gray-500 mb-1">County</label>
                    <input
                      v-model="formState.propertyAddress.county"
                      type="text"
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                </div>
                <div class="w-1/2">
                  <label class="block text-xs text-gray-500 mb-1">Postcode *</label>
                  <input
                    v-model="formState.propertyAddress.postcode"
                    type="text"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary uppercase"
                  />
                </div>
              </div>
            </div>

            <!-- Tenancy Start Date -->
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Tenancy Start Date</label>
                <input
                  v-model="formState.tenancyStartDate"
                  type="date"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Date of Notice *</label>
                <input
                  v-model="formState.dateOfNotice"
                  type="date"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
            </div>
          </div>

          <!-- Step 4: Review & Generate -->
          <div v-else-if="formState.currentStep === 4" class="space-y-6">
            <div>
              <h4 class="text-base font-semibold text-gray-900 mb-1">Review & Generate</h4>
              <p class="text-sm text-gray-500">
                Review the notice details and configure delivery options.
              </p>
            </div>

            <!-- Notice Preview -->
            <div class="border border-gray-200 rounded-lg overflow-hidden">
              <div class="bg-gray-50 px-4 py-2 border-b border-gray-200">
                <p class="text-xs font-medium text-gray-500 uppercase tracking-wider">Notice Preview</p>
              </div>
              <div class="p-4 font-mono text-xs text-gray-700 whitespace-pre-wrap bg-white max-h-64 overflow-y-auto">{{ noticePreview }}</div>
            </div>

            <!-- Signatory -->
            <div class="space-y-4">
              <h5 class="text-sm font-medium text-gray-700 dark:text-slate-200">Signatory Details</h5>

              <div>
                <label class="block text-xs text-gray-500 mb-1">Signed by *</label>
                <input
                  v-model="formState.signatoryName"
                  type="text"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  placeholder="Your name"
                />
              </div>

              <div>
                <label class="block text-xs text-gray-500 mb-1">Signing as</label>
                <select
                  v-model="formState.signatoryCapacity"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  <option value="agent_for_landlord">For and on behalf of {{ agentName }}, Letting Agents for the Landlord</option>
                  <option value="landlord">Landlord</option>
                  <option value="authorised_agent">Authorised Agent for the Landlord</option>
                  <option value="custom">Custom</option>
                </select>
                <input
                  v-if="formState.signatoryCapacity === 'custom'"
                  v-model="formState.signatoryCapacityCustom"
                  type="text"
                  class="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  placeholder="Enter your capacity..."
                />
              </div>
            </div>

            <!-- Email Options -->
            <div class="space-y-4">
              <h5 class="text-sm font-medium text-gray-700 dark:text-slate-200">Email Delivery</h5>

              <!-- Send to Tenants -->
              <div class="bg-gray-50 rounded-lg p-4 space-y-3">
                <label class="flex items-center gap-3 cursor-pointer">
                  <input
                    v-model="formState.sendToTenants"
                    type="checkbox"
                    class="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span class="text-sm font-medium text-gray-700 dark:text-slate-200">Send to tenant(s)</span>
                </label>

                <div v-if="formState.sendToTenants" class="pl-7 space-y-2">
                  <div v-for="target in formState.tenantEmailTargets" :key="target.email" class="flex items-center gap-3">
                    <input
                      v-model="target.selected"
                      type="checkbox"
                      class="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <span class="text-sm text-gray-700">{{ target.name }}</span>
                    <span class="text-sm text-gray-500">{{ target.email }}</span>
                  </div>
                  <div v-for="target in tenantsWithoutEmail" :key="target.name" class="flex items-center gap-2 text-sm text-amber-600">
                    <AlertTriangle class="w-4 h-4" />
                    <span>{{ target.name }} has no email address on record</span>
                  </div>
                </div>
              </div>

              <!-- Send to Landlord -->
              <label class="flex items-center gap-3 cursor-pointer">
                <input
                  v-model="formState.sendCopyToLandlord"
                  type="checkbox"
                  class="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span class="text-sm text-gray-700">Send copy to landlord</span>
                <span v-if="formState.landlordEmail" class="text-sm text-gray-500">({{ formState.landlordEmail }})</span>
                <span v-else class="text-sm text-amber-600">(no email on record)</span>
              </label>

              <!-- CC to Office -->
              <label class="flex items-center gap-3 cursor-pointer">
                <input
                  v-model="formState.ccToOffice"
                  type="checkbox"
                  class="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span class="text-sm text-gray-700">CC to office</span>
                <span class="text-sm text-gray-500">({{ formState.officeEmail }})</span>
              </label>

              <!-- Additional Recipients -->
              <div>
                <label class="block text-xs text-gray-500 mb-1">Additional recipients (comma-separated emails)</label>
                <input
                  v-model="formState.additionalRecipients"
                  type="text"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  placeholder="e.g. solicitor@example.com, manager@example.com"
                />
              </div>
            </div>

            <!-- No Email Warning -->
            <div v-if="!hasAnyEmailRecipient" class="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div class="flex items-start gap-3">
                <AlertTriangle class="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p class="text-sm font-medium text-amber-800">No email recipients selected</p>
                  <p class="text-sm text-amber-700 mt-1">
                    The notice will be generated but not emailed. You must serve it manually (e.g. by post or hand delivery).
                  </p>
                  <label class="flex items-center gap-2 mt-2 cursor-pointer">
                    <input
                      v-model="confirmManualService"
                      type="checkbox"
                      class="w-4 h-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                    />
                    <span class="text-sm text-amber-800">I will serve this notice manually</span>
                  </label>
                </div>
              </div>
            </div>

            <!-- Disclaimer -->
            <div class="bg-gray-50 rounded-lg p-4">
              <p class="text-xs text-gray-500 leading-relaxed">
                <strong>Disclaimer:</strong> This notice is generated for your convenience and does not constitute legal advice.
                Ensure all details are accurate. For complex situations (e.g. corporate landlords, overseas ownership structures)
                consider seeking legal advice before serving.
              </p>
            </div>

            <!-- Error Display -->
            <div v-if="formState.error" class="bg-red-50 border border-red-200 rounded-lg p-4">
              <div class="flex items-start gap-3">
                <AlertTriangle class="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p class="text-sm font-medium text-red-800">Error</p>
                  <p class="text-sm text-red-700 mt-1">{{ formState.error }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <button
            v-if="formState.currentStep > 1"
            @click="prevStep"
            :disabled="formState.isGenerating"
            class="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg flex items-center gap-2 disabled:opacity-50"
          >
            <ChevronLeft class="w-4 h-4" />
            Back
          </button>
          <div v-else />

          <div class="flex items-center gap-3">
            <button
              @click="handleClose"
              :disabled="formState.isGenerating"
              class="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              v-if="formState.currentStep < 4"
              @click="nextStep"
              :disabled="!canProceed"
              class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight class="w-4 h-4" />
            </button>

            <button
              v-else
              @click="generateAndSend"
              :disabled="!canGenerate || formState.isGenerating"
              class="px-5 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Loader2 v-if="formState.isGenerating" class="w-4 h-4 animate-spin" />
              <FileDown v-else class="w-4 h-4" />
              {{ formState.isGenerating ? 'Generating...' : 'Generate PDF & Send Notice' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, reactive } from 'vue'
import { useToast } from 'vue-toastification'
import { useAuthStore } from '@/stores/auth'
import {
  X, Scale, Check, Loader2, ChevronLeft, ChevronRight, AlertTriangle,
  CheckCircle, Plus, Trash2, FileDown
} from 'lucide-vue-next'
import type {
  Section48FormState,
  Address,
  AddressForServiceType,
  ReasonForServing
} from '@/types/section48'
import {
  INITIAL_FORM_STATE,
  REASON_LABELS,
  formatAddress,
  isValidEnglandWalesPostcode,
  isPOBox
} from '@/types/section48'
import { API_URL } from '@/lib/apiUrl'

const props = defineProps<{
  show: boolean
  tenancy: any
  landlords: any[]
}>()

const emit = defineEmits<{
  close: []
  generated: [noticeId: string]
}>()

const toast = useToast()
const authStore = useAuthStore()
const steps = [
  { id: 1, label: 'Address for Service' },
  { id: 2, label: 'Landlord Details' },
  { id: 3, label: 'Tenant & Property' },
  { id: 4, label: 'Review & Generate' }
]

// Form state
const formState = reactive<Section48FormState>({ ...INITIAL_FORM_STATE })

// Edit modes
const editingLandlordNames = ref(false)
const editingLandlordAddress = ref(false)
const editingTenantNames = ref(false)
const editingPropertyAddress = ref(false)
const confirmManualService = ref(false)

// Agent details (loaded from company)
const agentName = ref('PropertyGoose')
const agentAddress = reactive<Address>({
  line1: '1-4 Lawrence Hill',
  city: 'Bristol',
  postcode: 'BS5 0BY'
})
const agentEmail = ref('')
const agentPhone = ref('')

// Computed
const hasLandlordAddress = computed(() => {
  return formState.landlordAddress.line1 && formState.landlordAddress.postcode
})

const tenantsWithoutEmail = computed(() => {
  return formState.tenantEmailTargets.filter(t => !t.email).map(t => ({ name: t.name }))
})

const hasAnyEmailRecipient = computed(() => {
  const hasTenantEmails = formState.sendToTenants &&
    formState.tenantEmailTargets.some(t => t.selected && t.email)
  const hasLandlordEmail = formState.sendCopyToLandlord && formState.landlordEmail
  const hasOfficeEmail = formState.ccToOffice && formState.officeEmail
  const hasAdditional = formState.additionalRecipients.trim().length > 0

  return hasTenantEmails || hasLandlordEmail || hasOfficeEmail || hasAdditional
})

const otherAddressWarnings = computed(() => {
  const warnings: string[] = []
  if (formState.addressForServiceType !== 'other') return warnings

  const addr = formState.addressForService
  if (isPOBox(addr.line1) || isPOBox(addr.line2 || '')) {
    warnings.push('PO Box addresses are not permitted under Section 48')
  }
  if (addr.postcode && !isValidEnglandWalesPostcode(addr.postcode)) {
    warnings.push('Address must be in England or Wales')
  }
  return warnings
})

const canProceed = computed(() => {
  switch (formState.currentStep) {
    case 1:
      if (formState.addressForServiceType === 'other') {
        return formState.addressForService.line1 &&
               formState.addressForService.city &&
               formState.addressForService.postcode &&
               otherAddressWarnings.value.length === 0
      }
      return true
    case 2:
      return formState.landlordNames.filter(n => n.trim()).length > 0 &&
             (!formState.isCompanyLandlord || formState.companyRegisteredName?.trim())
    case 3:
      return formState.tenantNames.filter(n => n.trim()).length > 0 &&
             formState.propertyAddress.line1 &&
             formState.propertyAddress.postcode &&
             formState.dateOfNotice
    default:
      return true
  }
})

const canGenerate = computed(() => {
  return formState.signatoryName.trim() &&
         (hasAnyEmailRecipient.value || confirmManualService.value)
})

const noticePreview = computed(() => {
  const landlordDisplay = formState.isCompanyLandlord && formState.companyRegisteredName
    ? formState.companyRegisteredName
    : formState.landlordNames.filter(n => n.trim()).join(' and ')

  const tenantDisplay = formState.tenantNames.filter(n => n.trim()).join(' and ')
  const propertyDisplay = formatAddress(formState.propertyAddress)
  const landlordAddrDisplay = formatAddress(formState.landlordAddress)

  let serviceAddrName = ''
  let serviceAddr: Address
  if (formState.addressForServiceType === 'agent') {
    serviceAddrName = agentName.value
    serviceAddr = agentAddress
  } else if (formState.addressForServiceType === 'landlord') {
    serviceAddrName = landlordDisplay
    serviceAddr = formState.landlordAddress
  } else {
    serviceAddrName = formState.addressForServiceName || 'The Addressee'
    serviceAddr = formState.addressForService
  }

  const startDateFormatted = formState.tenancyStartDate
    ? new Date(formState.tenancyStartDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : '[tenancy start date]'

  const noticeDateFormatted = formState.dateOfNotice
    ? new Date(formState.dateOfNotice).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : '[date]'

  const reasonText = formState.reasonForServing === 'address_changed' || formState.reasonForServing === 'change_of_agent'
    ? `\nThis notice supersedes any previous address for service of notices that may have been given. Please use the above address for all future notices to the Landlord.\n`
    : ''

  const sigCapacity = formState.signatoryCapacity === 'custom'
    ? formState.signatoryCapacityCustom
    : formState.signatoryCapacity === 'agent_for_landlord'
      ? `For and on behalf of ${agentName.value}, Letting Agents for the Landlord`
      : formState.signatoryCapacity === 'landlord'
        ? 'Landlord'
        : 'Authorised Agent for the Landlord'

  return `══════════════════════════════════════════════════════════════
NOTICE UNDER SECTION 48 OF THE LANDLORD AND TENANT ACT 1987
══════════════════════════════════════════════════════════════

To:      ${tenantDisplay}
         ${propertyDisplay}

From:    ${landlordDisplay}
         ${landlordAddrDisplay}

Date:    ${noticeDateFormatted}

RE:      ${propertyDisplay}

Dear ${tenantDisplay},

We write on behalf of ${landlordDisplay} ("the Landlord") in
respect of the above property, currently let to you under a
tenancy commencing ${startDateFormatted}.

Pursuant to Section 48 of the Landlord and Tenant Act 1987,
you are hereby given notice that the address in England and
Wales at which notices (including notices in legal
proceedings) may be served on the Landlord is:

         ${serviceAddrName}
         ${serviceAddr.line1}${serviceAddr.line2 ? '\n         ' + serviceAddr.line2 : ''}
         ${serviceAddr.city}${serviceAddr.county ? '\n         ' + serviceAddr.county : ''}
         ${serviceAddr.postcode}
${reasonText}
This notice is given under and in accordance with Section 48
of the Landlord and Tenant Act 1987.

Yours sincerely,

${formState.signatoryName || '[Signatory Name]'}
${sigCapacity}
${noticeDateFormatted}

══════════════════════════════════════════════════════════════
${agentName.value} | ${formatAddress(agentAddress)}
${agentPhone.value ? 'Tel: ' + agentPhone.value + ' | ' : ''}${agentEmail.value ? 'Email: ' + agentEmail.value : ''}
══════════════════════════════════════════════════════════════`
})

// Methods
function getStepClass(step: number) {
  if (formState.currentStep > step) {
    return 'bg-primary text-white'
  } else if (formState.currentStep === step) {
    return 'bg-primary text-white'
  }
  return 'bg-gray-200 text-gray-500'
}

function selectAddressType(type: AddressForServiceType) {
  formState.addressForServiceType = type

  if (type === 'agent') {
    formState.addressForServiceName = agentName.value
    formState.addressForService = { ...agentAddress }
  } else if (type === 'landlord') {
    formState.addressForServiceName = formState.landlordNames.join(' and ')
    formState.addressForService = { ...formState.landlordAddress }
  }
}

function nextStep() {
  if (canProceed.value && formState.currentStep < 4) {
    formState.currentStep++
  }
}

function prevStep() {
  if (formState.currentStep > 1) {
    formState.currentStep--
  }
}

function handleClose() {
  if (formState.isGenerating) return
  emit('close')
}

async function loadCompanyDetails() {
  try {
    const token = authStore.session?.access_token
    if (!token) return

    const response = await fetch(`${API_URL}/api/company`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (response.ok) {
      const data = await response.json()
      const company = data.company || data
      agentName.value = company.name || 'PropertyGoose'
      agentAddress.line1 = company.address_line1 || company.address || ''
      agentAddress.city = company.city || ''
      agentAddress.postcode = company.postcode || ''
      agentEmail.value = company.email || ''
      agentPhone.value = company.phone || ''
      // Prefer reference_notification_email for office CC, fallback to general email
      formState.officeEmail = company.reference_notification_email || company.email || ''
    }
  } catch (error) {
    console.error('Failed to load company details:', error)
  }
}

function populateFromTenancy() {
  if (!props.tenancy) return

  const t = props.tenancy
  const p = t.property || {}

  // Property address
  formState.propertyAddress = {
    line1: p.address_line1 || '',
    line2: p.address_line2 || '',
    city: p.city || '',
    county: p.county || '',
    postcode: p.postcode || ''
  }

  // Tenant names and emails
  const tenants = t.tenants || []
  formState.tenantNames = tenants.map((tenant: any) => {
    const title = tenant.title || ''
    const firstName = tenant.first_name || ''
    const lastName = tenant.last_name || ''
    return [title, firstName, lastName].filter(Boolean).join(' ').trim()
  })

  formState.tenantEmailTargets = tenants.map((tenant: any) => ({
    name: [tenant.title, tenant.first_name, tenant.last_name].filter(Boolean).join(' ').trim(),
    email: tenant.email || '',
    selected: !!tenant.email
  }))

  // Tenancy dates
  formState.tenancyStartDate = t.tenancy_start_date || t.start_date || ''
  formState.dateOfNotice = new Date().toISOString().split('T')[0]

  // Landlord details from props.landlords
  if (props.landlords && props.landlords.length > 0) {
    formState.landlordNames = props.landlords.map((landlord: any) => {
      if (landlord.first_name && landlord.last_name) {
        return `${landlord.first_name} ${landlord.last_name}`.trim()
      }
      return landlord.name || ''
    }).filter(Boolean)

    const primaryLandlord = props.landlords.find((l: any) => l.is_primary_contact) || props.landlords[0]
    if (primaryLandlord) {
      formState.landlordAddress = {
        line1: primaryLandlord.address_line1 || '',
        line2: primaryLandlord.address_line2 || '',
        city: primaryLandlord.city || '',
        postcode: primaryLandlord.postcode || ''
      }
      formState.landlordEmail = primaryLandlord.email || ''
    }
  }

  // Set default address for service to agent
  selectAddressType('agent')
}

async function generateAndSend() {
  formState.isGenerating = true
  formState.error = undefined

  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    // Determine service address
    let serviceAddress: Address
    let serviceAddressName: string
    if (formState.addressForServiceType === 'agent') {
      serviceAddress = { ...agentAddress }
      serviceAddressName = agentName.value
    } else if (formState.addressForServiceType === 'landlord') {
      serviceAddress = { ...formState.landlordAddress }
      serviceAddressName = formState.landlordNames.join(' and ')
    } else {
      serviceAddress = { ...formState.addressForService }
      serviceAddressName = formState.addressForServiceName
    }

    // Collect recipient emails
    const tenantEmails = formState.sendToTenants
      ? formState.tenantEmailTargets.filter(t => t.selected && t.email).map(t => t.email)
      : []

    const additionalEmails = formState.additionalRecipients
      .split(',')
      .map(e => e.trim())
      .filter(e => e.includes('@'))

    // Determine signatory capacity text
    let signatoryCapacityText = ''
    if (formState.signatoryCapacity === 'custom') {
      signatoryCapacityText = formState.signatoryCapacityCustom || ''
    } else if (formState.signatoryCapacity === 'agent_for_landlord') {
      signatoryCapacityText = `For and on behalf of ${agentName.value}, Letting Agents for the Landlord`
    } else if (formState.signatoryCapacity === 'landlord') {
      signatoryCapacityText = 'Landlord'
    } else {
      signatoryCapacityText = 'Authorised Agent for the Landlord'
    }

    const payload = {
      tenancyId: props.tenancy.id,
      propertyId: props.tenancy.property_id,
      addressForServiceType: formState.addressForServiceType,
      addressForService: serviceAddress,
      addressForServiceName: serviceAddressName,
      reasonForServing: formState.reasonForServing,
      reasonForServingCustom: formState.reasonForServingCustom,
      landlordNames: formState.landlordNames.filter(n => n.trim()),
      isCompanyLandlord: formState.isCompanyLandlord,
      companyRegisteredName: formState.companyRegisteredName,
      companyRegistrationNumber: formState.companyRegistrationNumber,
      landlordAddress: formState.landlordAddress,
      tenantNames: formState.tenantNames.filter(n => n.trim()),
      propertyAddress: formState.propertyAddress,
      tenancyStartDate: formState.tenancyStartDate,
      dateOfNotice: formState.dateOfNotice,
      signatoryName: formState.signatoryName,
      signatoryCapacity: signatoryCapacityText,
      sendToTenants: formState.sendToTenants,
      tenantEmails,
      sendCopyToLandlord: formState.sendCopyToLandlord,
      landlordEmail: formState.landlordEmail,
      ccToOffice: formState.ccToOffice,
      officeEmail: formState.officeEmail,
      additionalRecipients: additionalEmails
    }

    const response = await fetch(`${API_URL}/api/legal/generate-section48`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || 'Failed to generate notice')
    }

    const result = await response.json()

    if (result.emailStatus === 'sent') {
      toast.success('Section 48 Notice generated and sent successfully')
    } else if (result.emailStatus === 'failed') {
      toast.warning('Notice generated but email delivery failed. The PDF has been saved to documents.')
    } else {
      toast.success('Section 48 Notice generated and saved to documents')
    }

    emit('generated', result.noticeId)
    emit('close')

  } catch (error: any) {
    console.error('Failed to generate Section 48 notice:', error)
    formState.error = error.message || 'An error occurred'
    toast.error(error.message || 'Failed to generate notice')
  } finally {
    formState.isGenerating = false
  }
}

// Reset form when modal opens
watch(() => props.show, async (isShow) => {
  if (isShow) {
    // Reset to initial state
    Object.assign(formState, { ...INITIAL_FORM_STATE })
    editingLandlordNames.value = false
    editingLandlordAddress.value = false
    editingTenantNames.value = false
    editingPropertyAddress.value = false
    confirmManualService.value = false

    formState.isLoading = true
    await loadCompanyDetails()
    populateFromTenancy()
    formState.isLoading = false
  }
})
</script>
