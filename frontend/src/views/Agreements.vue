<template>
  <Sidebar>
    <div class="p-8">
      <div class="mb-8">
        <h2 class="text-3xl font-bold text-gray-900">Generate AST Agreement</h2>
        <p class="mt-2 text-gray-600">Create an Assured Shorthold Tenancy Agreement</p>
      </div>

      <!-- Progress Steps -->
      <div class="mb-8">
        <div class="flex items-center justify-between">
          <div v-for="(step, index) in steps" :key="index" class="flex-1">
            <div class="flex items-center">
              <div class="flex items-center flex-col">
                <div
                  class="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-colors"
                  :class="
                    currentStep > index
                      ? 'bg-green-500 text-white'
                      : currentStep === index
                      ? 'bg-primary text-white'
                      : 'bg-gray-200 text-gray-600'
                  "
                >
                  <svg v-if="currentStep > index" class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                  </svg>
                  <span v-else>{{ index + 1 }}</span>
                </div>
                <span class="text-xs mt-2 text-center font-medium" :class="currentStep === index ? 'text-primary' : 'text-gray-600'">{{ step }}</span>
              </div>
              <div v-if="index < steps.length - 1" class="flex-1 h-0.5 mx-4" :class="currentStep > index ? 'bg-green-500' : 'bg-gray-200'"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Form Container -->
      <div class="bg-white rounded-lg shadow p-6">
        <!-- Step 1: Select Template -->
        <div v-if="currentStep === 0">
          <h3 class="text-xl font-semibold text-gray-900 mb-4">Select Agreement Template</h3>
          <p class="text-sm text-gray-600 mb-6">Choose the deposit protection scheme for this tenancy</p>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
              v-for="template in templateOptions"
              :key="template.value"
              @click="formData.templateType = template.value"
              class="border-2 rounded-lg p-6 cursor-pointer transition-all hover:shadow-md"
              :class="
                formData.templateType === template.value
                  ? 'border-primary bg-primary/5'
                  : 'border-gray-200 hover:border-primary/50'
              "
            >
              <div class="flex items-start">
                <div
                  class="w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 flex-shrink-0"
                  :class="
                    formData.templateType === template.value
                      ? 'border-primary bg-primary'
                      : 'border-gray-300'
                  "
                >
                  <div v-if="formData.templateType === template.value" class="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <div class="ml-3">
                  <h4 class="font-semibold text-gray-900">{{ template.label }}</h4>
                  <p class="text-sm text-gray-600 mt-1">{{ template.description }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Step 2: Property Address -->
        <div v-if="currentStep === 1">
          <h3 class="text-xl font-semibold text-gray-900 mb-4">Property Address</h3>
          <div class="space-y-4 max-w-2xl">
            <AddressAutocomplete
              v-model="formData.propertyAddress.line1"
              label="Property Address"
              :required="true"
              placeholder="Start typing the property address..."
              @addressSelected="handlePropertyAddressSelected"
            />
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
              <input
                v-model="formData.propertyAddress.line2"
                type="text"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                placeholder="Apartment, suite, etc. (optional)"
              />
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">City *</label>
                <input
                  v-model="formData.propertyAddress.city"
                  type="text"
                  required
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">County</label>
                <input
                  v-model="formData.propertyAddress.county"
                  type="text"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                />
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Postcode *</label>
              <input
                v-model="formData.propertyAddress.postcode"
                type="text"
                required
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                placeholder="SW1A 1AA"
              />
            </div>
          </div>
        </div>

        <!-- Step 3: Agreement Details -->
        <div v-if="currentStep === 2">
          <h3 class="text-xl font-semibold text-gray-900 mb-4">Agreement Details</h3>
          <div class="space-y-4 max-w-2xl">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Rent Amount *</label>
                <div class="relative">
                  <span class="absolute left-3 top-2 text-gray-500">£</span>
                  <input
                    v-model.number="formData.rentAmount"
                    type="number"
                    step="0.01"
                    required
                    class="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Deposit Amount *</label>
                <div class="relative">
                  <span class="absolute left-3 top-2 text-gray-500">£</span>
                  <input
                    v-model.number="formData.depositAmount"
                    type="number"
                    step="0.01"
                    required
                    class="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Tenancy Start Date *</label>
                <input
                  v-model="formData.tenancyStartDate"
                  type="date"
                  required
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Tenancy Term *</label>
                <div class="flex items-center gap-3">
                  <input
                    v-model.number="formData.tenancyTerm"
                    type="number"
                    min="0"
                    step="1"
                    required
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                    placeholder="e.g. 6, 12"
                  />
                  <span class="text-sm text-gray-600 whitespace-nowrap">months</span>
                </div>
                <p class="text-xs text-gray-500 mt-1">Enter 0 for rolling (month-to-month)</p>
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Rent Due Date *</label>
              <select
                v-model="formData.rentDueDay"
                required
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
              >
                <option value="1st">1st of each month</option>
                <option value="2nd">2nd of each month</option>
                <option value="5th">5th of each month</option>
                <option value="10th">10th of each month</option>
                <option value="15th">15th of each month</option>
                <option value="20th">20th of each month</option>
                <option value="25th">25th of each month</option>
                <option value="Last">Last day of each month</option>
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Deposit Scheme Type *</label>
              <select
                v-model="formData.depositSchemeType"
                required
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
              >
                <option value="Custodial">Custodial Scheme</option>
                <option value="Insured">Insured Scheme</option>
              </select>
              <p class="text-xs text-gray-500 mt-1">Custodial: Deposit held by scheme. Insured: You hold deposit as stakeholder.</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Permitted Occupier(s)</label>
              <input
                v-model="formData.permittedOccupiers"
                type="text"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                placeholder="Names of any permitted occupiers (optional)"
              />
              <p class="text-xs text-gray-500 mt-1">People allowed to live at the property but not named as tenants</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Management Type *</label>
              <select
                v-model="formData.managementType"
                required
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
              >
                <option value="managed">Fully Managed (Agent manages property)</option>
                <option value="let_only">Let Only (Landlord manages property)</option>
              </select>
              <p class="text-xs text-gray-500 mt-1">Managed: Agent details used. Let Only: Landlord details used.</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Tenant Email *</label>
              <input
                v-model="formData.tenantEmail"
                type="email"
                required
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                placeholder="tenant@example.com"
              />
              <p class="text-xs text-gray-500 mt-1">Primary tenant's email address</p>
            </div>

            <div v-if="formData.managementType === 'let_only'">
              <label class="block text-sm font-medium text-gray-700 mb-1">Landlord Email *</label>
              <input
                v-model="formData.landlordEmail"
                type="email"
                :required="formData.managementType === 'let_only'"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                placeholder="landlord@example.com"
              />
              <p class="text-xs text-gray-500 mt-1">First landlord's email address</p>
            </div>

            <div v-if="formData.managementType === 'let_only'">
              <h4 class="font-semibold text-gray-900 mt-6 mb-3">Landlord Bank Details</h4>
              <div class="space-y-3">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Account Name *</label>
                  <input
                    v-model="formData.bankAccountName"
                    type="text"
                    :required="formData.managementType === 'let_only'"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                    placeholder="Account holder name"
                  />
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Account Number *</label>
                    <input
                      v-model="formData.bankAccountNumber"
                      type="text"
                      :required="formData.managementType === 'let_only'"
                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                      placeholder="12345678"
                      maxlength="8"
                    />
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Sort Code *</label>
                    <input
                      v-model="formData.bankSortCode"
                      type="text"
                      :required="formData.managementType === 'let_only'"
                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                      placeholder="12-34-56"
                      maxlength="8"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Break Clause</label>
              <textarea
                v-model="formData.breakClause"
                rows="3"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                placeholder="e.g., Either party may terminate this tenancy with 2 months notice after the first 6 months"
              ></textarea>
              <p class="text-xs text-gray-500 mt-1">Optional break clause text (leave empty if not applicable)</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Special Clauses</label>
              <textarea
                v-model="formData.specialClauses"
                rows="4"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                placeholder="Any special terms or conditions for this tenancy"
              ></textarea>
              <p class="text-xs text-gray-500 mt-1">Optional additional clauses (leave empty if not applicable)</p>
            </div>
          </div>
        </div>

        <!-- Step 4: Landlords -->
        <div v-if="currentStep === 3">
          <h3 class="text-xl font-semibold text-gray-900 mb-4">Landlord Details</h3>
          <p class="text-sm text-gray-600 mb-6">Add up to 20 landlords for this agreement</p>

          <div v-for="(landlord, index) in formData.landlords" :key="'landlord-' + index" class="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
            <div class="flex justify-between items-center mb-4">
              <h4 class="font-medium text-gray-900">Landlord {{ index + 1 }}</h4>
              <button
                v-if="formData.landlords.length > 1"
                @click="removeLandlord(index)"
                type="button"
                class="text-red-600 hover:text-red-700 text-sm font-medium"
              >
                Remove
              </button>
            </div>

            <div class="space-y-3">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <input
                  v-model="landlord.name"
                  type="text"
                  required
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary bg-white"
                />
              </div>
              <AddressAutocomplete
                v-model="landlord.address.line1"
                label="Landlord Address"
                :required="true"
                :id="'landlord-address-' + index"
                placeholder="Start typing address..."
                @addressSelected="(addr) => handleLandlordAddressSelected(index, addr)"
              />
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
                <input
                  v-model="landlord.address.line2"
                  type="text"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary bg-white"
                />
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">City *</label>
                  <input
                    v-model="landlord.address.city"
                    type="text"
                    required
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary bg-white"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Postcode *</label>
                  <input
                    v-model="landlord.address.postcode"
                    type="text"
                    required
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary bg-white"
                  />
                </div>
              </div>
            </div>
          </div>

          <button
            v-if="formData.landlords.length < 20"
            @click="addLandlord"
            type="button"
            class="mt-4 px-4 py-2 text-sm font-medium text-primary border border-primary rounded-md hover:bg-primary/5"
          >
            + Add Another Landlord
          </button>
        </div>

        <!-- Step 5: Tenants -->
        <div v-if="currentStep === 4">
          <h3 class="text-xl font-semibold text-gray-900 mb-4">Tenant Details</h3>
          <p class="text-sm text-gray-600 mb-6">Add up to 20 tenants for this agreement</p>

          <div v-for="(tenant, index) in formData.tenants" :key="'tenant-' + index" class="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
            <div class="flex justify-between items-center mb-4">
              <h4 class="font-medium text-gray-900">Tenant {{ index + 1 }}</h4>
              <button
                v-if="formData.tenants.length > 1"
                @click="removeTenant(index)"
                type="button"
                class="text-red-600 hover:text-red-700 text-sm font-medium"
              >
                Remove
              </button>
            </div>

            <div class="space-y-3">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <input
                  v-model="tenant.name"
                  type="text"
                  required
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary bg-white"
                />
              </div>
              <AddressAutocomplete
                v-model="tenant.address.line1"
                label="Tenant Address"
                :required="true"
                :id="'tenant-address-' + index"
                placeholder="Start typing address..."
                @addressSelected="(addr) => handleTenantAddressSelected(index, addr)"
              />
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
                <input
                  v-model="tenant.address.line2"
                  type="text"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary bg-white"
                />
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">City *</label>
                  <input
                    v-model="tenant.address.city"
                    type="text"
                    required
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary bg-white"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Postcode *</label>
                  <input
                    v-model="tenant.address.postcode"
                    type="text"
                    required
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary bg-white"
                  />
                </div>
              </div>
            </div>
          </div>

          <button
            v-if="formData.tenants.length < 20"
            @click="addTenant"
            type="button"
            class="mt-4 px-4 py-2 text-sm font-medium text-primary border border-primary rounded-md hover:bg-primary/5"
          >
            + Add Another Tenant
          </button>
        </div>

        <!-- Step 6: Guarantors -->
        <div v-if="currentStep === 5">
          <h3 class="text-xl font-semibold text-gray-900 mb-4">Guarantor Details (Optional)</h3>
          <p class="text-sm text-gray-600 mb-6">Add up to 20 guarantors for this agreement, or skip if none required</p>

          <div v-if="formData.guarantors.length === 0" class="text-center py-8">
            <p class="text-gray-500 mb-4">No guarantors added yet</p>
            <button
              @click="addGuarantor"
              type="button"
              class="px-4 py-2 text-sm font-medium text-primary border border-primary rounded-md hover:bg-primary/5"
            >
              + Add Guarantor
            </button>
          </div>

          <div v-else>
            <div v-for="(guarantor, index) in formData.guarantors" :key="'guarantor-' + index" class="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
              <div class="flex justify-between items-center mb-4">
                <h4 class="font-medium text-gray-900">Guarantor {{ index + 1 }}</h4>
                <button
                  @click="removeGuarantor(index)"
                  type="button"
                  class="text-red-600 hover:text-red-700 text-sm font-medium"
                >
                  Remove
                </button>
              </div>

              <div class="space-y-3">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                  <input
                    v-model="guarantor.name"
                    type="text"
                    required
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary bg-white"
                  />
                </div>
                <AddressAutocomplete
                  v-model="guarantor.address.line1"
                  label="Guarantor Address"
                  :required="true"
                  :id="'guarantor-address-' + index"
                  placeholder="Start typing address..."
                  @addressSelected="(addr) => handleGuarantorAddressSelected(index, addr)"
                />
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
                  <input
                    v-model="guarantor.address.line2"
                    type="text"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary bg-white"
                  />
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">City *</label>
                    <input
                      v-model="guarantor.address.city"
                      type="text"
                      required
                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary bg-white"
                    />
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Postcode *</label>
                    <input
                      v-model="guarantor.address.postcode"
                      type="text"
                      required
                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary bg-white"
                    />
                  </div>
                </div>
              </div>
            </div>

            <button
              v-if="formData.guarantors.length < 20"
              @click="addGuarantor"
              type="button"
              class="mt-4 px-4 py-2 text-sm font-medium text-primary border border-primary rounded-md hover:bg-primary/5"
            >
              + Add Another Guarantor
            </button>
          </div>
        </div>

        <!-- Step 7: Review & Generate -->
        <div v-if="currentStep === 6">
          <h3 class="text-xl font-semibold text-gray-900 mb-4">Review & Generate</h3>
          <p class="text-sm text-gray-600 mb-6">Please review the information before generating the agreement</p>

          <div class="space-y-6">
            <!-- Template Type -->
            <div class="border-b pb-4">
              <h4 class="font-semibold text-gray-900 mb-2">Agreement Template</h4>
              <p class="text-gray-700">{{ getTemplateLabel(formData.templateType) }}</p>
            </div>

            <!-- Property Address -->
            <div class="border-b pb-4">
              <h4 class="font-semibold text-gray-900 mb-2">Property Address</h4>
              <p class="text-gray-700">
                {{ formData.propertyAddress.line1 }}<br />
                <span v-if="formData.propertyAddress.line2">{{ formData.propertyAddress.line2 }}<br /></span>
                {{ formData.propertyAddress.city }}<br />
                <span v-if="formData.propertyAddress.county">{{ formData.propertyAddress.county }}<br /></span>
                {{ formData.propertyAddress.postcode }}
              </p>
            </div>

            <!-- Landlords -->
            <div class="border-b pb-4">
              <h4 class="font-semibold text-gray-900 mb-2">Landlords ({{ formData.landlords.length }})</h4>
              <div v-for="(landlord, index) in formData.landlords" :key="'review-landlord-' + index" class="mb-3">
                <p class="text-gray-700 font-medium">{{ index + 1 }}. {{ landlord.name }}</p>
                <p class="text-sm text-gray-600 ml-4">{{ formatAddress(landlord.address) }}</p>
              </div>
            </div>

            <!-- Tenants -->
            <div class="border-b pb-4">
              <h4 class="font-semibold text-gray-900 mb-2">Tenants ({{ formData.tenants.length }})</h4>
              <div v-for="(tenant, index) in formData.tenants" :key="'review-tenant-' + index" class="mb-3">
                <p class="text-gray-700 font-medium">{{ index + 1 }}. {{ tenant.name }}</p>
                <p class="text-sm text-gray-600 ml-4">{{ formatAddress(tenant.address) }}</p>
              </div>
            </div>

            <!-- Guarantors -->
            <div class="border-b pb-4">
              <h4 class="font-semibold text-gray-900 mb-2">Guarantors ({{ formData.guarantors.length }})</h4>
              <div v-if="formData.guarantors.length === 0">
                <p class="text-gray-500 italic">No guarantors</p>
              </div>
              <div v-else v-for="(guarantor, index) in formData.guarantors" :key="'review-guarantor-' + index" class="mb-3">
                <p class="text-gray-700 font-medium">{{ index + 1 }}. {{ guarantor.name }}</p>
                <p class="text-sm text-gray-600 ml-4">{{ formatAddress(guarantor.address) }}</p>
              </div>
            </div>

            <!-- Financial Details -->
            <div class="border-b pb-4">
              <h4 class="font-semibold text-gray-900 mb-2">Financial Details</h4>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <p class="text-sm text-gray-600">Rent Amount</p>
                  <p class="text-gray-700 font-medium">£{{ formData.rentAmount || 0 }}</p>
                </div>
                <div>
                  <p class="text-sm text-gray-600">Deposit Amount</p>
                  <p class="text-gray-700 font-medium">£{{ formData.depositAmount || 0 }}</p>
                </div>
                <div>
                  <p class="text-sm text-gray-600">Rent Due Day</p>
                  <p class="text-gray-700 font-medium">{{ formData.rentDueDay }}</p>
                </div>
                <div>
                  <p class="text-sm text-gray-600">Deposit Scheme Type</p>
                  <p class="text-gray-700 font-medium">{{ formData.depositSchemeType }}</p>
                </div>
              </div>
            </div>

            <!-- Tenancy Dates -->
            <div class="border-b pb-4">
              <h4 class="font-semibold text-gray-900 mb-2">Tenancy Dates</h4>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <p class="text-sm text-gray-600">Start Date</p>
                  <p class="text-gray-700 font-medium">{{ formData.tenancyStartDate ? new Date(formData.tenancyStartDate).toLocaleDateString('en-GB') : 'Not set' }}</p>
                </div>
                <div>
                  <p class="text-sm text-gray-600">Tenancy Term</p>
                  <p class="text-gray-700 font-medium">{{ formData.tenancyTerm }} months</p>
                </div>
                <div>
                  <p class="text-sm text-gray-600">End Date</p>
                  <p class="text-gray-700 font-medium">{{ displayEndDate }}</p>
                </div>
              </div>
            </div>

            <!-- Additional Details -->
            <div class="border-b pb-4">
              <h4 class="font-semibold text-gray-900 mb-2">Additional Details</h4>
              <div>
                <p class="text-sm text-gray-600">Permitted Occupier(s)</p>
                <p class="text-gray-700 font-medium">{{ formData.permittedOccupiers || 'None' }}</p>
              </div>
            </div>
          </div>

          <div v-if="error" class="mt-6 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
            {{ error }}
          </div>

          <div v-if="success" class="mt-6 bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded">
            {{ success }}
          </div>
        </div>

        <!-- Navigation Buttons -->
        <div class="mt-8 flex justify-between">
          <button
            v-if="currentStep > 0"
            @click="previousStep"
            type="button"
            class="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Back
          </button>
          <div v-else></div>

          <button
            v-if="currentStep < steps.length - 1"
            @click="nextStep"
            :disabled="!canProceed"
            type="button"
            class="px-6 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue
          </button>
          <button
            v-else
            @click="generateAgreement"
            :disabled="loading"
            type="button"
            class="px-6 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span v-if="loading">Generating...</span>
            <span v-else>Generate Agreement</span>
          </button>
        </div>
      </div>
    </div>
  </Sidebar>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import Sidebar from '../components/Sidebar.vue'
import AddressAutocomplete from '../components/AddressAutocomplete.vue'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()

const steps = ['Template', 'Property', 'Details', 'Landlords', 'Tenants', 'Guarantors', 'Review']
const currentStep = ref(0)
const loading = ref(false)
const error = ref('')
const success = ref('')

const templateOptions = [
  {
    value: 'dps',
    label: 'DPS (Deposit Protection Service)',
    description: 'For tenancies using the Deposit Protection Service (Custodial or Insured)'
  },
  {
    value: 'mydeposits',
    label: 'Mydeposits',
    description: 'For tenancies using the Mydeposits scheme (Custodial or Insured)'
  },
  {
    value: 'tds',
    label: 'TDS (Tenancy Deposit Scheme)',
    description: 'For tenancies using the Tenancy Deposit Scheme operated by The Dispute Service Ltd'
  },
  {
    value: 'no_deposit',
    label: 'No Deposit',
    description: 'For tenancies where no monetary deposit is taken'
  }
]

interface Address {
  line1: string
  line2?: string
  city: string
  county?: string
  postcode: string
}

interface Party {
  name: string
  address: Address
}

const formData = ref<{
  templateType: string
  propertyAddress: Address
  rentAmount?: number
  depositAmount?: number
  tenancyStartDate?: string
  tenancyTerm: string | number
  rentDueDay: string
  depositSchemeType: string
  permittedOccupiers?: string
  managementType: 'managed' | 'let_only'
  tenantEmail?: string
  landlordEmail?: string
  agentEmail?: string
  bankAccountName?: string
  bankAccountNumber?: string
  bankSortCode?: string
  breakClause?: string
  specialClauses?: string
  landlords: Party[]
  tenants: Party[]
  guarantors: Party[]
}>({
  templateType: '',
  propertyAddress: {
    line1: '',
    line2: '',
    city: '',
    county: '',
    postcode: ''
  },
  rentAmount: undefined,
  depositAmount: undefined,
  tenancyStartDate: '',
  tenancyTerm: 12,
  rentDueDay: '1st',
  depositSchemeType: 'Custodial',
  permittedOccupiers: '',
  managementType: 'let_only',
  tenantEmail: '',
  landlordEmail: '',
  agentEmail: '',
  bankAccountName: '',
  bankAccountNumber: '',
  bankSortCode: '',
  breakClause: '',
  specialClauses: '',
  landlords: [
    {
      name: '',
      address: { line1: '', line2: '', city: '', county: '', postcode: '' }
    }
  ],
  tenants: [
    {
      name: '',
      address: { line1: '', line2: '', city: '', county: '', postcode: '' }
    }
  ],
  guarantors: []
})

// Fetch company settings on mount
onMounted(() => {
  fetchCompanySettings()
})

// Re-fetch when management type changes
watch(() => formData.value.managementType, () => {
  if (formData.value.managementType === 'managed') {
    fetchCompanySettings()
  }
})

// Computed property to calculate end date from start date + term
// Returns ISO format (YYYY-MM-DD) for database storage
const calculatedEndDate = computed(() => {
  if (!formData.value.tenancyStartDate) {
    return null
  }

  const months = Number(formData.value.tenancyTerm)

  // 0 months means rolling tenancy
  if (isNaN(months) || months === 0) {
    return null // Send null for rolling tenancies
  }

  const startDate = new Date(formData.value.tenancyStartDate)
  startDate.setMonth(startDate.getMonth() + months)
  // Return ISO format for database (YYYY-MM-DD)
  return startDate.toISOString().split('T')[0]
})

// Display-friendly end date for the review page
const displayEndDate = computed(() => {
  if (!calculatedEndDate.value) {
    return 'Rolling (month-to-month)'
  }
  const date = new Date(calculatedEndDate.value)
  return date.toLocaleDateString('en-GB')
})

const canProceed = computed(() => {
  switch (currentStep.value) {
    case 0: // Template selection
      return formData.value.templateType !== ''
    case 1: // Property address
      return (
        formData.value.propertyAddress.line1 !== '' &&
        formData.value.propertyAddress.city !== '' &&
        formData.value.propertyAddress.postcode !== ''
      )
    case 2: // Agreement details
      const baseValid = (
        formData.value.rentAmount !== undefined && formData.value.rentAmount > 0 &&
        formData.value.depositAmount !== undefined && formData.value.depositAmount >= 0 &&
        formData.value.tenancyStartDate !== '' &&
        formData.value.tenancyTerm !== '' &&
        formData.value.rentDueDay !== '' &&
        formData.value.depositSchemeType !== '' &&
        (formData.value.managementType === 'managed' || formData.value.managementType === 'let_only') &&
        formData.value.tenantEmail !== ''
      )

      // If let_only, also require landlord email and bank details
      if (formData.value.managementType === 'let_only') {
        return baseValid &&
          formData.value.landlordEmail !== '' &&
          formData.value.bankAccountName !== '' &&
          formData.value.bankAccountNumber !== '' &&
          formData.value.bankSortCode !== ''
      }

      return baseValid
    case 3: // Landlords
      return formData.value.landlords.every(
        (l) => l.name !== '' && l.address.line1 !== '' && l.address.city !== '' && l.address.postcode !== ''
      )
    case 4: // Tenants
      return formData.value.tenants.every(
        (t) => t.name !== '' && t.address.line1 !== '' && t.address.city !== '' && t.address.postcode !== ''
      )
    case 5: // Guarantors (optional, so always can proceed)
      if (formData.value.guarantors.length === 0) return true
      return formData.value.guarantors.every(
        (g) => g.name !== '' && g.address.line1 !== '' && g.address.city !== '' && g.address.postcode !== ''
      )
    default:
      return true
  }
})

function nextStep() {
  if (canProceed.value && currentStep.value < steps.length - 1) {
    currentStep.value++
  }
}

function previousStep() {
  if (currentStep.value > 0) {
    currentStep.value--
  }
}

function addLandlord() {
  if (formData.value.landlords.length < 20) {
    formData.value.landlords.push({
      name: '',
      address: { line1: '', line2: '', city: '', county: '', postcode: '' }
    })
  }
}

function removeLandlord(index: number) {
  formData.value.landlords.splice(index, 1)
}

function addTenant() {
  if (formData.value.tenants.length < 20) {
    formData.value.tenants.push({
      name: '',
      address: { line1: '', line2: '', city: '', county: '', postcode: '' }
    })
  }
}

function removeTenant(index: number) {
  formData.value.tenants.splice(index, 1)
}

function addGuarantor() {
  if (formData.value.guarantors.length < 20) {
    formData.value.guarantors.push({
      name: '',
      address: { line1: '', line2: '', city: '', county: '', postcode: '' }
    })
  }
}

function removeGuarantor(index: number) {
  formData.value.guarantors.splice(index, 1)
}

function getTemplateLabel(value: string): string {
  const template = templateOptions.find((t) => t.value === value)
  return template ? template.label : value
}

function formatAddress(address: Address): string {
  const parts = [
    address.line1,
    address.line2,
    address.city,
    address.county,
    address.postcode
  ].filter(Boolean)
  return parts.join(', ')
}

// Address autocomplete handlers
function handlePropertyAddressSelected(addr: any) {
  formData.value.propertyAddress.line1 = addr.addressLine1
  formData.value.propertyAddress.city = addr.city
  formData.value.propertyAddress.postcode = addr.postcode
}

function handleLandlordAddressSelected(index: number, addr: any) {
  if (formData.value.landlords[index]) {
    formData.value.landlords[index].address.line1 = addr.addressLine1
    formData.value.landlords[index].address.city = addr.city
    formData.value.landlords[index].address.postcode = addr.postcode
  }
}

function handleTenantAddressSelected(index: number, addr: any) {
  if (formData.value.tenants[index]) {
    formData.value.tenants[index].address.line1 = addr.addressLine1
    formData.value.tenants[index].address.city = addr.city
    formData.value.tenants[index].address.postcode = addr.postcode
  }
}

function handleGuarantorAddressSelected(index: number, addr: any) {
  if (formData.value.guarantors[index]) {
    formData.value.guarantors[index].address.line1 = addr.addressLine1
    formData.value.guarantors[index].address.city = addr.city
    formData.value.guarantors[index].address.postcode = addr.postcode
  }
}

// Fetch company settings for managed properties
async function fetchCompanySettings() {
  try {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
    const token = authStore.session?.access_token

    const response = await fetch(`${API_URL}/api/company/settings`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (response.ok) {
      const { company } = await response.json()
      // Populate agent email and bank details if managed
      if (formData.value.managementType === 'managed' && company) {
        formData.value.agentEmail = company.email || ''
        formData.value.bankAccountName = company.bank_account_name || ''
        formData.value.bankAccountNumber = company.bank_account_number || ''
        formData.value.bankSortCode = company.bank_sort_code || ''
      }
    }
  } catch (err) {
    console.error('Error fetching company settings:', err)
  }
}

async function generateAgreement() {
  loading.value = true
  error.value = ''
  success.value = ''

  try {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
    const token = authStore.session?.access_token

    if (!token) {
      throw new Error('You must be logged in to generate an agreement')
    }

    // Create the agreement with calculated end date
    const agreementData = {
      ...formData.value,
      tenancyEndDate: calculatedEndDate.value
    }

    const createResponse = await fetch(`${API_URL}/api/agreements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(agreementData)
    })

    if (!createResponse.ok) {
      const errorData = await createResponse.json()
      throw new Error(errorData.error || 'Failed to create agreement')
    }

    const { agreement } = await createResponse.json()

    // Generate the DOCX file
    const generateResponse = await fetch(`${API_URL}/api/agreements/${agreement.id}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    })

    if (!generateResponse.ok) {
      const errorData = await generateResponse.json()
      throw new Error(errorData.error || 'Failed to generate agreement file')
    }

    const { fileUrl } = await generateResponse.json()

    success.value = 'Agreement generated successfully!'

    // Download the file
    setTimeout(() => {
      window.open(fileUrl, '_blank')
      // Optionally redirect to agreements list page
      // router.push('/agreements/list')
    }, 1500)
  } catch (err: any) {
    console.error('Error generating agreement:', err)
    error.value = err.message || 'Failed to generate agreement'
  } finally {
    loading.value = false
  }
}
</script>
