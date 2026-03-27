<template>
  <Sidebar>
    <div class="p-8">
      <div v-if="loading" class="flex justify-center items-center h-64">
        <div class="text-gray-600 dark:text-slate-400">Loading property...</div>
      </div>

      <div v-else-if="error" class="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-600 dark:text-red-400 px-4 py-3 rounded">
        {{ error }}
      </div>

      <div v-else-if="property" class="space-y-6">
        <!-- Header -->
        <div class="flex justify-between items-start">
          <div>
            <button @click="$router.push('/properties')"
              class="text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white mb-4 flex items-center">
              <ArrowLeft class="w-5 h-5 mr-2" />
              Back to Properties
            </button>
            <h2 class="text-3xl font-bold text-gray-900 dark:text-white">
              {{ displayAddress }}
            </h2>
            <p class="mt-2 text-gray-600 dark:text-slate-400">{{ property.address.postcode }}</p>
          </div>
          <div class="flex items-center gap-3">
            <button @click="showEditModal = true"
              class="flex items-center px-4 py-2 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary/90 transition-colors">
              <Pencil class="w-4 h-4 mr-2" />
              Edit
            </button>
            <button @click="deleteProperty"
              :disabled="deleting"
              class="flex items-center px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 transition-colors disabled:opacity-50">
              <Trash2 class="w-4 h-4 mr-2" />
              {{ deleting ? 'Deleting...' : 'Delete' }}
            </button>
            <span class="px-3 py-1 text-sm font-semibold rounded-full" :class="{
              'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200': property.status === 'in_tenancy',
              'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-200': property.status === 'vacant'
            }">
              {{ property.status === 'in_tenancy' ? 'In Tenancy' : 'Vacant' }}
            </span>
          </div>
        </div>

        <!-- Three Column Layout -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <!-- Left Column: Compliance -->
          <div class="lg:col-span-3 space-y-4">
            <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-4">
              <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Compliance</h3>
                <div class="flex items-center gap-2">
                  <button
                    v-if="propertyLandlords.length > 0 && complianceRecords.length > 0"
                    @click="showLandlordPackModal = true"
                    class="inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80"
                    title="Send compliance documents to landlord(s)"
                  >
                    <Send class="w-3.5 h-3.5" />
                    Send to Landlord
                  </button>
                  <button @click="showAddComplianceModal = true"
                    class="text-sm text-primary hover:text-primary/80">
                    + Add
                  </button>
                </div>
              </div>

              <div v-if="complianceRecords.length === 0" class="text-sm text-gray-500 dark:text-slate-400">
                No compliance records yet
              </div>

              <div v-else class="space-y-3">
                <div v-for="record in complianceRecords" :key="record.id"
                  class="p-3 rounded-lg border" :class="getComplianceBorderClass(record.status)">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <div class="w-2 h-2 rounded-full" :class="getComplianceDotClass(record.status)"></div>
                      <span class="text-sm font-medium text-gray-900 dark:text-white">
                        {{ formatComplianceType(record.compliance_type) }}
                      </span>
                    </div>
                    <button @click="editCompliance(record)" class="text-gray-400 hover:text-gray-600 dark:text-slate-400 dark:hover:text-slate-200">
                      <Pencil class="w-3 h-3" />
                    </button>
                  </div>
                  <div class="mt-1 text-xs text-gray-600 dark:text-slate-300">
                    <span v-if="record.expiry_date">
                      {{ record.status === 'expired' ? 'Expired' : 'Expires' }}:
                      {{ formatDate(record.expiry_date) }}
                    </span>
                    <span v-else>No expiry set</span>
                  </div>
                  <div v-if="record.certificate_number" class="mt-1 text-xs text-gray-500 dark:text-slate-400">
                    Cert: {{ record.certificate_number }}
                  </div>
                  <!-- Document link -->
                  <div v-if="record.documents && record.documents.length > 0" class="mt-2">
                    <button
                      @click="viewComplianceDocument(record)"
                      class="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80"
                    >
                      <FileText class="w-3 h-3" />
                      View Certificate
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Center Column: Property Details -->
          <div class="lg:col-span-5 space-y-4">
            <!-- Address Card -->
            <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Address</h3>
              <div class="space-y-2 text-sm text-gray-900 dark:text-white">
                <p v-if="property.address.line1">{{ property.address.line1 }}</p>
                <p v-if="property.address.line2">{{ property.address.line2 }}</p>
                <p v-if="property.address.city">{{ property.address.city }}</p>
                <p v-if="property.address.county">{{ property.address.county }}</p>
                <p class="font-medium">{{ property.address.postcode }}</p>
              </div>
            </div>

            <!-- Property Details Card -->
            <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Details</h3>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-500 dark:text-slate-400">Property Type</label>
                  <p class="mt-1 text-sm text-gray-900 dark:text-white">{{ formatPropertyType(property.property_type) || 'Not specified' }}</p>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-500 dark:text-slate-400">Bedrooms</label>
                  <p class="mt-1 text-sm text-gray-900 dark:text-white">{{ property.number_of_bedrooms || 'Not specified' }}</p>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-500 dark:text-slate-400">Bathrooms</label>
                  <p class="mt-1 text-sm text-gray-900 dark:text-white">{{ property.number_of_bathrooms || 'Not specified' }}</p>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-500 dark:text-slate-400">Council Tax Band</label>
                  <p class="mt-1 text-sm text-gray-900 dark:text-white">{{ property.council_tax_band || 'Not specified' }}</p>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-500 dark:text-slate-400">Furnishing</label>
                  <p class="mt-1 text-sm text-gray-900 dark:text-white">{{ formatFurnishing(property.furnishing_status) || 'Not specified' }}</p>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-500 dark:text-slate-400">Management Type</label>
                  <p class="mt-1 text-sm text-gray-900 dark:text-white">
                    <span v-if="property.management_type" :class="{
                      'px-2 py-0.5 text-xs font-medium rounded-full': true,
                      'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200': property.management_type === 'managed',
                      'bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-200': property.management_type === 'let_only'
                    }">
                      {{ formatManagementType(property.management_type) }}
                    </span>
                    <span v-else class="text-gray-400 dark:text-slate-500">Not specified</span>
                  </p>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-500 dark:text-slate-400">Bills Included</label>
                  <p class="mt-1 text-sm text-gray-900 dark:text-white">
                    <span v-if="property.bills_included" class="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200">
                      Yes
                    </span>
                    <span v-else class="text-gray-400 dark:text-slate-500">No</span>
                  </p>
                </div>
              </div>
            </div>

            <!-- License Info Card -->
            <div v-if="property.is_licensed" class="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">License</h3>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-500 dark:text-slate-400">License Number</label>
                  <p class="mt-1 text-sm text-gray-900 dark:text-white">{{ property.license_number || 'Not provided' }}</p>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-500 dark:text-slate-400">Expiry Date</label>
                  <p class="mt-1 text-sm text-gray-900 dark:text-white">{{ property.license_expiry_date ? formatDate(property.license_expiry_date) : 'Not set' }}</p>
                </div>
              </div>
            </div>

            <!-- Notes Card -->
            <div v-if="property.notes" class="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Notes</h3>
              <p class="text-sm text-gray-700 dark:text-slate-300 whitespace-pre-wrap">{{ property.notes }}</p>
            </div>

            <!-- Special Clauses Card -->
            <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
              <div class="flex justify-between items-center mb-2">
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Special Clauses</h3>
              </div>

              <!-- Helper text -->
              <p class="text-xs text-gray-500 dark:text-slate-400 mb-4">
                Type your clauses roughly and GooseAI will format them professionally. All special clauses will be inserted into Section 11 of any tenancy agreement merged on this property.
              </p>

              <!-- Enhanced Preview Modal (for all clauses) -->
              <div v-if="showEnhancedPreview && enhancedClausesPreview.length > 0" class="mb-4 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/30 dark:to-indigo-900/30 border border-purple-200 dark:border-purple-700 rounded-lg">
                <div class="flex items-center gap-2 mb-3">
                  <Sparkles class="w-4 h-4 text-purple-600" />
                  <span class="text-sm font-medium text-purple-800 dark:text-purple-200">GooseAI Enhanced Clauses</span>
                </div>
                <div class="space-y-2 mb-4">
                  <div
                    v-for="(clause, index) in enhancedClausesPreview"
                    :key="index"
                    class="p-3 bg-white dark:bg-slate-800 rounded-lg border border-purple-100 dark:border-purple-700"
                  >
                    <span class="text-xs font-semibold text-purple-600 dark:text-purple-300">11.{{ index + 2 }}</span>
                    <p class="text-sm text-gray-700 dark:text-slate-300 mt-1">{{ clause }}</p>
                  </div>
                </div>
                <div class="flex justify-end gap-2">
                  <button
                    @click="rejectEnhancedClauses"
                    class="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
                  >
                    Keep Original
                  </button>
                  <button
                    @click="acceptEnhancedClauses"
                    :disabled="savingClauses"
                    class="px-3 py-1.5 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
                  >
                    {{ savingClauses ? 'Saving...' : 'Accept All' }}
                  </button>
                </div>
              </div>

              <!-- Clauses list -->
              <div v-if="specialClauses.length > 0 && !showEnhancedPreview" class="space-y-3 mb-4">
                <div
                  v-for="(clause, index) in specialClauses"
                  :key="index"
                  class="p-3 bg-gray-50 dark:bg-slate-700 rounded-lg border border-gray-200 dark:border-slate-600 group"
                >
                  <!-- Editing mode -->
                  <div v-if="editingClauseIndex === index">
                    <div class="flex items-center gap-2 mb-2">
                      <span class="text-xs font-semibold text-gray-500 dark:text-slate-400">Clause {{ index + 1 }}</span>
                    </div>
                    <textarea
                      v-model="editClauseText"
                      rows="2"
                      class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:ring-primary focus:border-primary text-sm"
                    ></textarea>
                    <div class="flex justify-end gap-2 mt-2">
                      <button
                        @click="editingClauseIndex = -1"
                        class="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
                      >
                        Cancel
                      </button>
                      <button
                        @click="saveEditedClause(index)"
                        :disabled="!editClauseText.trim() || savingClauses"
                        class="px-3 py-1.5 text-sm bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50"
                      >
                        {{ savingClauses ? 'Saving...' : 'Save' }}
                      </button>
                    </div>
                  </div>
                  <!-- Display mode -->
                  <div v-else>
                    <div class="flex items-start justify-between gap-2">
                      <div class="flex-1">
                        <span class="text-xs font-semibold text-gray-500 dark:text-slate-400">Clause {{ index + 1 }}</span>
                        <p class="text-sm text-gray-700 dark:text-slate-300 mt-1">{{ clause }}</p>
                      </div>
                      <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          @click="startEditClause(index)"
                          class="p-1 text-gray-400 hover:text-gray-600"
                          title="Edit"
                        >
                          <Pencil class="w-3 h-3" />
                        </button>
                        <button
                          @click="removeSpecialClause(index)"
                          class="p-1 text-gray-400 hover:text-red-500"
                          title="Remove"
                        >
                          <Trash2 class="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Add clause input -->
              <div v-if="showAddClauseInput && !showEnhancedPreview" class="mb-4">
                <div class="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-700">
                  <div class="flex items-center gap-2 mb-2">
                    <span class="text-xs font-semibold text-blue-600 dark:text-blue-300">New Clause</span>
                  </div>
                  <textarea
                    v-model="newClauseText"
                    placeholder="Type roughly what you want, e.g. 'no smoking' or 'pets allowed with extra deposit'..."
                    rows="2"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                  ></textarea>
                  <div class="flex justify-end gap-2 mt-2">
                    <button
                      @click="cancelAddClause"
                      class="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
                    >
                      Cancel
                    </button>
                    <button
                      @click="addSpecialClause"
                      :disabled="!newClauseText.trim() || savingClauses"
                      class="px-3 py-1.5 text-sm bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50"
                    >
                      {{ savingClauses ? 'Saving...' : 'Add Clause' }}
                    </button>
                  </div>
                </div>
              </div>

              <!-- Empty state -->
              <div v-if="specialClauses.length === 0 && !showAddClauseInput && !showEnhancedPreview" class="text-center py-4 mb-4">
                <p class="text-sm text-gray-500 dark:text-slate-400">No special clauses yet</p>
              </div>

              <!-- Action buttons -->
              <div v-if="!showEnhancedPreview" class="flex flex-wrap gap-2 pt-2 border-t border-gray-100 dark:border-slate-700">
                <button
                  v-if="!showAddClauseInput"
                  @click="showAddClauseInput = true"
                  class="px-3 py-1.5 text-sm text-primary hover:bg-primary/5 rounded-md flex items-center gap-1"
                >
                  <Plus class="w-4 h-4" />
                  Add New Clause
                </button>
                <button
                  v-if="specialClauses.length > 0"
                  @click="enhanceAllClauses"
                  :disabled="enhancingClause"
                  class="px-3 py-1.5 text-sm bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-md hover:from-purple-600 hover:to-indigo-600 disabled:opacity-50 flex items-center gap-1.5 ml-auto"
                >
                  <Loader2 v-if="enhancingClause" class="w-3.5 h-3.5 animate-spin" />
                  <Sparkles v-else class="w-3.5 h-3.5" />
                  {{ enhancingClause ? 'Enhancing...' : 'Enhance All with GooseAI' }}
                </button>
              </div>
            </div>

            <!-- Status Override Card -->
            <div v-if="property.status_override" class="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg p-4">
              <div class="flex items-center gap-2 mb-2">
                <AlertTriangle class="w-4 h-4 text-amber-600" />
                <span class="text-sm font-medium text-amber-800 dark:text-amber-200">Manual Status Override</span>
              </div>
              <p class="text-sm text-amber-700 dark:text-amber-300">{{ property.status_override_reason || 'No reason provided' }}</p>
            </div>
          </div>

          <!-- Right Column: Landlords & Documents Tabs -->
          <div class="lg:col-span-4">
            <div class="bg-white dark:bg-slate-800 rounded-lg shadow">
              <!-- Tab Headers -->
              <div class="border-b border-gray-200 dark:border-slate-700">
                <nav class="-mb-px flex">
                  <button @click="rightTab = 'landlords'" :class="[
                    'flex-1 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm text-center',
                    rightTab === 'landlords'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:border-gray-300 dark:hover:border-slate-500'
                  ]">
                    Landlords
                  </button>
                  <button @click="rightTab = 'documents'" :class="[
                    'flex-1 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm text-center',
                    rightTab === 'documents'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:border-gray-300 dark:hover:border-slate-500'
                  ]">
                    Documents
                  </button>
                  <button @click="rightTab = 'activity'; fetchActivity()" :class="[
                    'flex-1 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm text-center',
                    rightTab === 'activity'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:border-gray-300 dark:hover:border-slate-500'
                  ]">
                    Activity
                  </button>
                  <button @click="rightTab = 'tenancies'; fetchPropertyTenancies()" :class="[
                    'flex-1 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm text-center',
                    rightTab === 'tenancies'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:border-gray-300 dark:hover:border-slate-500'
                  ]">
                    Tenancies
                  </button>
                </nav>
              </div>

              <!-- Landlords Tab Content -->
              <div v-if="rightTab === 'landlords'" class="p-4">
                <div class="flex justify-between items-center mb-4">
                  <h4 class="text-sm font-medium text-gray-700 dark:text-slate-300">Ownership</h4>
                  <button @click="showEditLandlordsModal = true"
                    class="text-sm text-primary hover:text-primary/80">
                    Edit
                  </button>
                </div>

                <div v-if="propertyLandlords.length === 0" class="text-sm text-gray-500 dark:text-slate-400">
                  No landlords linked
                </div>

                <div v-else class="space-y-3">
                  <div v-for="pl in propertyLandlords" :key="pl.landlord_id"
                    class="p-3 border border-gray-200 dark:border-slate-700 rounded-lg">
                    <div class="flex justify-between items-start">
                      <div>
                        <router-link :to="`/landlords/${pl.landlord_id}`"
                          class="text-sm font-medium text-gray-900 dark:text-white hover:text-primary">
                          {{ pl.name }}
                        </router-link>
                        <p class="text-xs text-gray-500 dark:text-slate-400 mt-1">{{ pl.email }}</p>
                      </div>
                      <div class="flex items-center gap-2">
                        <span v-if="pl.is_primary_contact"
                          class="text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">
                          Primary
                        </span>
                        <span class="text-sm font-semibold text-gray-900 dark:text-white">
                          {{ pl.ownership_percentage }}%
                        </span>
                      </div>
                    </div>
                    <!-- Ownership bar visualization -->
                    <div class="mt-2 h-2 bg-gray-100 dark:bg-slate-600 rounded-full overflow-hidden">
                      <div class="h-full bg-primary rounded-full transition-all"
                        :style="{ width: `${pl.ownership_percentage}%` }">
                      </div>
                    </div>
                  </div>

                  <!-- Total ownership indicator -->
                  <div class="pt-2 border-t border-gray-200 dark:border-slate-700">
                    <div class="flex justify-between text-sm">
                      <span class="text-gray-500 dark:text-slate-400">Total Ownership</span>
                      <span :class="totalOwnership === 100 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'">
                        {{ totalOwnership }}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Documents Tab Content -->
              <div v-if="rightTab === 'documents'" class="p-4">
                <div class="flex justify-between items-center mb-4">
                  <h4 class="text-sm font-medium text-gray-700 dark:text-slate-300">Property Documents</h4>
                  <button @click="showUploadDocumentModal = true"
                    class="text-sm text-primary hover:text-primary/80">
                    + Upload
                  </button>
                </div>

                <!-- Tag Filter -->
                <div class="flex flex-wrap gap-2 mb-4">
                  <button
                    v-for="tag in documentTags"
                    :key="tag.value"
                    @click="documentTagFilter = documentTagFilter === tag.value ? '' : tag.value"
                    :class="[
                      'px-2 py-1 text-xs rounded-full border transition-colors',
                      documentTagFilter === tag.value
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white dark:bg-slate-700 text-gray-600 dark:text-slate-300 border-gray-300 dark:border-slate-600 hover:border-primary'
                    ]"
                  >
                    {{ tag.label }}
                  </button>
                </div>

                <div v-if="filteredDocuments.length === 0" class="text-sm text-gray-500 dark:text-slate-400">
                  No documents uploaded
                </div>

                <div v-else class="space-y-2">
                  <div v-for="doc in filteredDocuments" :key="doc.id"
                    class="flex items-center justify-between p-2 bg-gray-50 dark:bg-slate-700 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-600 cursor-pointer transition-colors"
                    @click="openDocumentPreview(doc)">
                    <div class="flex items-center gap-2 min-w-0">
                      <FileText class="w-4 h-4 text-gray-400 dark:text-slate-400 flex-shrink-0" />
                      <div class="min-w-0">
                        <p class="text-sm text-gray-900 dark:text-white truncate">{{ doc.file_name }}</p>
                        <p class="text-xs text-gray-500 dark:text-slate-400">{{ formatFileSize(doc.file_size) }}</p>
                      </div>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="text-xs bg-gray-200 dark:bg-slate-600 text-gray-600 dark:text-slate-300 px-2 py-0.5 rounded">
                        {{ formatDocumentTag(doc.tag) }}
                      </span>
                      <button
                        v-if="apex27Connected"
                        @click.stop="pushPropertyDocToApex27(doc.id)"
                        :disabled="pushingDocId === doc.id"
                        class="text-gray-400 hover:text-[#6B21A8]"
                        title="Push to Apex27"
                      >
                        <Loader2 v-if="pushingDocId === doc.id" class="w-4 h-4 animate-spin" />
                        <Upload v-else class="w-4 h-4" />
                      </button>
                      <button @click.stop="downloadDocument(doc, true)" class="text-gray-400 hover:text-primary" title="Download">
                        <Download class="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Activity Tab Content -->
              <div v-if="rightTab === 'activity'" class="p-4">
                <h4 class="text-sm font-medium text-gray-700 dark:text-slate-300 mb-4">Property Activity</h4>

                <!-- Loading State -->
                <div v-if="loadingActivity" class="text-center py-8">
                  <div class="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>

                <!-- No Activity -->
                <div v-else-if="activities.length === 0" class="text-sm text-gray-500 dark:text-slate-400 text-center py-8">
                  No activity recorded yet
                </div>

                <!-- Activity Timeline -->
                <div v-else class="space-y-3">
                  <div
                    v-for="activity in activities"
                    :key="activity.id"
                    class="flex items-start gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div class="flex-shrink-0 w-2 h-2 mt-1.5 rounded-full bg-primary"></div>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm text-gray-900 dark:text-white">{{ activity.description }}</p>
                      <p class="text-xs text-gray-500 dark:text-slate-400 mt-1">
                        {{ formatActivityDate(activity.created_at) }}
                      </p>
                    </div>
                    <!-- Clickable action based on activity type -->
                    <button
                      v-if="getActivityLink(activity)"
                      @click="navigateToActivity(activity)"
                      class="flex-shrink-0 text-xs text-primary hover:text-primary/80 font-medium"
                    >
                      View
                    </button>
                  </div>
                </div>
              </div>

              <!-- Tenancies Tab Content -->
              <div v-if="rightTab === 'tenancies'" class="p-4">
                <div class="flex items-center justify-between mb-4">
                  <h4 class="text-sm font-medium text-gray-700 dark:text-slate-300">Property Tenancies</h4>
                  <button
                    @click="showCreateTenancyModal = true"
                    class="inline-flex items-center px-2.5 py-1 bg-primary text-white text-xs font-medium rounded-md hover:bg-primary/90 transition-colors"
                  >
                    <Plus class="w-3.5 h-3.5 mr-1" />
                    Create Tenancy
                  </button>
                </div>

                <!-- Loading State -->
                <div v-if="loadingTenancies" class="text-center py-8">
                  <div class="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>

                <!-- No Tenancies -->
                <div v-else-if="propertyTenancies.length === 0" class="text-sm text-gray-500 dark:text-slate-400 text-center py-8">
                  <KeyRound class="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-slate-600" />
                  <p>No tenancies for this property</p>
                </div>

                <!-- Tenancies List -->
                <div v-else class="space-y-3">
                  <div
                    v-for="tenancy in propertyTenancies"
                    :key="tenancy.id"
                    class="p-3 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors"
                    @click="$router.push('/tenancies')"
                  >
                    <div class="flex items-center justify-between mb-2">
                      <span
                        class="px-2 py-0.5 text-xs font-semibold rounded-full"
                        :class="getTenancyStatusClass(tenancy.status)"
                      >
                        {{ formatTenancyStatus(tenancy.status) }}
                      </span>
                      <span class="text-sm font-medium text-gray-900 dark:text-white">
                        &pound;{{ tenancy.monthly_rent?.toLocaleString() }}/mo
                      </span>
                    </div>

                    <!-- Tenants -->
                    <div class="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-300 mb-2">
                      <Users class="w-4 h-4" />
                      <span>{{ formatTenancyTenants(tenancy.tenants) }}</span>
                    </div>

                    <!-- Dates -->
                    <div class="flex justify-between text-xs text-gray-500 dark:text-slate-400">
                      <span>{{ formatDate(tenancy.start_date) }}</span>
                      <span v-if="tenancy.end_date">to {{ formatDate(tenancy.end_date) }}</span>
                      <span v-else class="text-gray-400 dark:text-slate-500">Periodic</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit Property Modal -->
    <AddEditPropertyModal
      v-if="showEditModal"
      :show="showEditModal"
      :property-id="property?.id"
      @close="showEditModal = false"
      @saved="handlePropertySaved"
    />

    <!-- Add Compliance Modal -->
    <AddComplianceModal
      v-if="showAddComplianceModal"
      :show="showAddComplianceModal"
      :property-id="property?.id"
      :compliance-record="editingComplianceRecord"
      @close="closeComplianceModal"
      @saved="handleComplianceSaved"
    />

    <!-- Upload Document Modal -->
    <UploadDocumentModal
      v-if="showUploadDocumentModal"
      :show="showUploadDocumentModal"
      :property-id="property?.id"
      @close="showUploadDocumentModal = false"
      @uploaded="handleDocumentUploaded"
    />

    <!-- Edit Property Landlords Modal -->
    <EditPropertyLandlordsModal
      v-if="showEditLandlordsModal"
      :show="showEditLandlordsModal"
      :property-id="property?.id || ''"
      :current-landlords="propertyLandlords"
      @close="showEditLandlordsModal = false"
      @saved="handleLandlordsSaved"
    />

    <!-- Create Tenancy Modal -->
    <CreateTenancyModal
      v-if="showCreateTenancyModal"
      :show="showCreateTenancyModal"
      :preselected-property-id="property?.id"
      @close="showCreateTenancyModal = false"
      @created="handleTenancyCreated"
    />

    <!-- Landlord Move-In Pack Modal -->
    <LandlordMoveInPackModal
      v-if="showLandlordPackModal"
      :show="showLandlordPackModal"
      :property-id="property?.id || ''"
      :property-address="displayAddress"
      :landlords="propertyLandlords"
      :compliance-documents="complianceDocsForPack"
      :property-docs="propertyDocuments"
      @close="showLandlordPackModal = false"
      @sent="showLandlordPackModal = false"
    />

    <!-- Document Preview Modal -->
    <div v-if="showDocumentPreview" class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-black/50" @click="closeDocumentPreview"></div>
      <div class="relative bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col">
        <!-- Header -->
        <div class="flex items-center justify-between p-4 border-b">
          <div class="min-w-0 flex-1">
            <h3 class="text-lg font-semibold text-gray-900 truncate">{{ previewDocument?.file_name }}</h3>
            <p class="text-sm text-gray-500 dark:text-slate-400">{{ previewDocument ? formatFileSize(previewDocument.file_size) : '' }}</p>
          </div>
          <div class="flex items-center gap-2 ml-4">
            <button
              @click="previewDocument && downloadDocument(previewDocument, true)"
              class="p-2 text-gray-500 hover:text-primary hover:bg-gray-100 rounded-lg transition-colors"
              title="Download"
            >
              <Download class="w-5 h-5" />
            </button>
            <button
              @click="closeDocumentPreview"
              class="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="Close"
            >
              <X class="w-5 h-5" />
            </button>
          </div>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-auto p-4 min-h-[400px] flex items-center justify-center bg-gray-50">
          <div v-if="previewLoading" class="text-gray-500 dark:text-slate-400">Loading preview...</div>
          <template v-else-if="previewUrl && previewDocument">
            <!-- Image Preview -->
            <img
              v-if="previewDocument.file_type.startsWith('image/')"
              :src="previewUrl"
              :alt="previewDocument.file_name"
              class="max-w-full max-h-full object-contain"
            />
            <!-- PDF Preview -->
            <iframe
              v-else-if="previewDocument.file_type === 'application/pdf'"
              :src="previewUrl"
              class="w-full h-full min-h-[500px]"
              frameborder="0"
            ></iframe>
            <!-- Non-previewable file -->
            <div v-else class="text-center">
              <FileText class="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p class="text-gray-600 mb-4">This file type cannot be previewed</p>
              <button
                @click="downloadDocument(previewDocument, true)"
                class="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              >
                Download File
              </button>
            </div>
          </template>
        </div>
      </div>
    </div>
  </Sidebar>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import { ArrowLeft, Pencil, FileText, Download, AlertTriangle, X, KeyRound, Users, Plus, Trash2, Sparkles, Loader2, Send, Upload } from 'lucide-vue-next'
import Sidebar from '../components/Sidebar.vue'
import AddEditPropertyModal from '../components/properties/AddEditPropertyModal.vue'
import AddComplianceModal from '../components/properties/AddComplianceModal.vue'
import UploadDocumentModal from '../components/properties/UploadDocumentModal.vue'
import EditPropertyLandlordsModal from '../components/properties/EditPropertyLandlordsModal.vue'
import CreateTenancyModal from '../components/tenancies/CreateTenancyModal.vue'
import LandlordMoveInPackModal from '../components/properties/LandlordMoveInPackModal.vue'
import { useAuthStore } from '../stores/auth'
import { authFetch } from '../lib/authFetch'
import { useDownload } from '../composables/useDownload'
import { formatDate as formatUkDate } from '../utils/date'

const API_URL = import.meta.env.VITE_API_URL ?? ''

interface PropertyLandlord {
  id: string
  landlord_id: string
  ownership_percentage: number
  is_primary_contact: boolean
  name: string
  email: string
}

interface ComplianceDocument {
  id: string
  file_name: string
  file_path: string
  is_current: boolean
}

interface ComplianceRecord {
  id: string
  compliance_type: string
  issue_date: string | null
  expiry_date: string | null
  status: 'valid' | 'expiring_soon' | 'expired'
  certificate_number: string | null
  issuer_name: string | null
  documents?: ComplianceDocument[]
}

interface PropertyDocument {
  id: string
  file_name: string
  file_path: string
  file_size: number
  file_type: string
  tag: string
  description?: string
  source?: 'property' | 'compliance'
  compliance_record_id?: string
}

interface Property {
  id: string
  address: {
    line1?: string
    line2?: string
    city?: string
    county?: string
    postcode: string
    full_address?: string
    formatted?: string
  }
  property_type: string | null
  number_of_bedrooms: number | null
  number_of_bathrooms: number | null
  council_tax_band: string | null
  furnishing_status: string | null
  management_type: 'managed' | 'let_only' | null
  bills_included?: boolean
  status: 'vacant' | 'in_tenancy'
  status_override: boolean
  status_override_reason?: string | null
  is_licensed: boolean
  license_number: string | null
  license_expiry_date: string | null
  notes: string | null
  special_clauses?: string[]
}

const route = useRoute()
const router = useRouter()
const toast = useToast()
const authStore = useAuthStore()
const { downloadFile, openInNewTab } = useDownload()
const loading = ref(false)
const deleting = ref(false)
const error = ref('')
const property = ref<Property | null>(null)
const propertyLandlords = ref<PropertyLandlord[]>([])
const complianceRecords = ref<ComplianceRecord[]>([])
const propertyDocuments = ref<PropertyDocument[]>([])

// Apex27
const apex27Connected = ref(false)
const pushingDocId = ref<string | null>(null)

const rightTab = ref<'landlords' | 'documents' | 'activity' | 'tenancies'>('landlords')
const documentTagFilter = ref('')
const showEditModal = ref(false)
const showEditLandlordsModal = ref(false)
const showAddComplianceModal = ref(false)
const showUploadDocumentModal = ref(false)
const showCreateTenancyModal = ref(false)
const showLandlordPackModal = ref(false)
const editingComplianceRecord = ref<ComplianceRecord | null>(null)
const showDocumentPreview = ref(false)
const previewDocument = ref<PropertyDocument | null>(null)
const previewUrl = ref<string | null>(null)
const previewLoading = ref(false)

// Activity tracking
const activities = ref<any[]>([])
const loadingActivity = ref(false)

// Tenancies tracking
const propertyTenancies = ref<any[]>([])
const loadingTenancies = ref(false)

// Special Clauses
const specialClauses = ref<string[]>([])
const showAddClauseInput = ref(false)
const newClauseText = ref('')
const editingClauseIndex = ref(-1)
const editClauseText = ref('')
const savingClauses = ref(false)

// AI Clause Enhancement
const enhancingClause = ref(false)
const showEnhancedPreview = ref(false)
const enhancedClausesPreview = ref<string[]>([])

const documentTags = [
  { value: 'gas', label: 'Gas' },
  { value: 'epc', label: 'EPC' },
  { value: 'agreement', label: 'Agreement' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'other', label: 'Other' }
]

const displayAddress = computed(() => {
  if (!property.value) return ''
  if (property.value.address.formatted) return property.value.address.formatted
  if (property.value.address.full_address) return property.value.address.full_address
  return property.value.address.line1 || property.value.address.postcode
})

const totalOwnership = computed(() => {
  return propertyLandlords.value.reduce((sum, pl) => sum + (pl.ownership_percentage || 0), 0)
})

const complianceDocsForPack = computed(() => {
  return complianceRecords.value
    .filter(r => r.status === 'valid' || r.status === 'expiring_soon')
    .map(r => ({
      id: r.id,
      type: r.compliance_type,
      file_url: r.documents?.[0]?.file_path || '',
      expiry_date: r.expiry_date
    }))
})

const filteredDocuments = computed(() => {
  if (!documentTagFilter.value) return propertyDocuments.value
  return propertyDocuments.value.filter(doc => doc.tag === documentTagFilter.value)
})

const fetchProperty = async () => {
  loading.value = true
  error.value = ''

  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const propertyId = route.params.id as string
    const response = await authFetch(`${API_URL}/api/properties/${propertyId}`, { token })

    if (!response.ok) {
      throw new Error('Failed to fetch property')
    }

    const data = await response.json()
    property.value = data.property
    propertyLandlords.value = data.landlords || []
    complianceRecords.value = data.compliance || []
    propertyDocuments.value = data.documents || []
    specialClauses.value = data.property?.special_clauses || []

    // Check if edit mode
    if (route.query.edit === 'true') {
      showEditModal.value = true
    }
  } catch (err: any) {
    error.value = err.message || 'Failed to load property'
    toast.error('Failed to load property')
  } finally {
    loading.value = false
  }
}

const handlePropertySaved = () => {
  showEditModal.value = false
  fetchProperty()
}

const deleteProperty = async () => {
  if (!property.value) return

  const confirmed = window.confirm(
    `Are you sure you want to delete this property?\n\n${displayAddress.value}\n\nThis action cannot be undone.`
  )

  if (!confirmed) return

  deleting.value = true
  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const response = await authFetch(`${API_URL}/api/properties/${property.value.id}`, {
      method: 'DELETE',
      token
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to delete property')
    }

    toast.success('Property deleted successfully')
    router.push('/properties')
  } catch (err: any) {
    toast.error(err.message || 'Failed to delete property')
  } finally {
    deleting.value = false
  }
}

// Special Clauses Functions
const saveSpecialClauses = async (clauses: string[]) => {
  if (!property.value) return

  savingClauses.value = true
  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const response = await authFetch(`${API_URL}/api/properties/${property.value.id}/special-clauses`, {
      method: 'PUT',
      token,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clauses })
    })

    if (!response.ok) {
      throw new Error('Failed to save special clauses')
    }

    const data = await response.json()
    specialClauses.value = data.clauses || clauses
    toast.success('Special clauses updated')
  } catch (err: any) {
    toast.error(err.message || 'Failed to save special clauses')
  } finally {
    savingClauses.value = false
  }
}

const addSpecialClause = async () => {
  if (!newClauseText.value.trim()) return

  const updatedClauses = [...specialClauses.value, newClauseText.value.trim()]
  await saveSpecialClauses(updatedClauses)
  newClauseText.value = ''
  showAddClauseInput.value = false
}

const cancelAddClause = () => {
  newClauseText.value = ''
  showAddClauseInput.value = false
}

const startEditClause = (index: number) => {
  editingClauseIndex.value = index
  editClauseText.value = specialClauses.value[index] ?? ''
}

const saveEditedClause = async (index: number) => {
  if (!editClauseText.value.trim()) return

  const updatedClauses = [...specialClauses.value]
  updatedClauses[index] = editClauseText.value.trim()
  await saveSpecialClauses(updatedClauses)
  editingClauseIndex.value = -1
  editClauseText.value = ''
}

const removeSpecialClause = async (index: number) => {
  const updatedClauses = specialClauses.value.filter((_, i) => i !== index)
  await saveSpecialClauses(updatedClauses)
}

// AI Clause Enhancement Functions
const enhanceAllClauses = async () => {
  if (specialClauses.value.length === 0 || !property.value) return

  enhancingClause.value = true
  enhancedClausesPreview.value = []
  showEnhancedPreview.value = false

  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const response = await authFetch(`${API_URL}/api/properties/${property.value.id}/enhance-clauses`, {
      method: 'POST',
      token,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clauses: specialClauses.value })
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to enhance clauses')
    }

    const data = await response.json()
    enhancedClausesPreview.value = data.enhancedClauses
    showEnhancedPreview.value = true
  } catch (err: any) {
    toast.error(err.message || 'Failed to enhance clauses')
  } finally {
    enhancingClause.value = false
  }
}

const acceptEnhancedClauses = async () => {
  await saveSpecialClauses(enhancedClausesPreview.value)
  showEnhancedPreview.value = false
  enhancedClausesPreview.value = []
}

const rejectEnhancedClauses = () => {
  showEnhancedPreview.value = false
  enhancedClausesPreview.value = []
}

const editCompliance = (record: ComplianceRecord) => {
  editingComplianceRecord.value = record
  showAddComplianceModal.value = true
}

const viewComplianceDocument = async (record: ComplianceRecord) => {
  if (!record.documents || record.documents.length === 0 || !property.value) return

  const doc = record.documents[0] // Get the current document
  if (!doc) return
  const url = `${API_URL}/api/properties/${property.value.id}/compliance/${record.id}/document/${doc.id}`

  // Open in new tab with auth token
  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const response = await authFetch(url, { token })

    if (!response.ok) {
      throw new Error('Failed to fetch document')
    }

    const blob = await response.blob()
    const blobUrl = window.URL.createObjectURL(blob)

    // Open in new tab
    window.open(blobUrl, '_blank')
  } catch (err) {
    toast.error('Failed to open document')
  }
}

const closeComplianceModal = () => {
  showAddComplianceModal.value = false
  editingComplianceRecord.value = null
}

const handleComplianceSaved = () => {
  closeComplianceModal()
  fetchProperty()
}

const handleDocumentUploaded = () => {
  showUploadDocumentModal.value = false
  fetchProperty()
}

const handleLandlordsSaved = () => {
  showEditLandlordsModal.value = false
  fetchProperty()
}

const handleTenancyCreated = () => {
  showCreateTenancyModal.value = false
  fetchPropertyTenancies()
}

// Fetch property tenancies
const fetchPropertyTenancies = async () => {
  if (!property.value) return

  loadingTenancies.value = true
  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const response = await authFetch(`${API_URL}/api/tenancies/records/active?propertyId=${property.value.id}`, { token })

    if (!response.ok) {
      throw new Error('Failed to fetch tenancies')
    }

    const data = await response.json()
    propertyTenancies.value = data.tenancies || []
  } catch (err: any) {
    console.error('Failed to fetch tenancies:', err)
  } finally {
    loadingTenancies.value = false
  }
}

// Format tenancy status for display
const formatTenancyStatus = (status: string) => {
  const labels: Record<string, string> = {
    pending: 'Pending',
    active: 'Active',
    notice_given: 'Notice Given',
    ended: 'Ended',
    terminated: 'Terminated',
    expired: 'Expired'
  }
  return labels[status] || status
}

// Get tenancy status CSS class
const getTenancyStatusClass = (status: string) => {
  const classes: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-800',
    active: 'bg-green-100 text-green-800',
    notice_given: 'bg-orange-100 text-orange-800',
    ended: 'bg-gray-100 text-gray-800',
    terminated: 'bg-red-100 text-red-800',
    expired: 'bg-gray-100 text-gray-600'
  }
  return classes[status] || 'bg-gray-100 text-gray-800'
}

// Format tenant names for tenancy display
const formatTenancyTenants = (tenants: any[]) => {
  if (!tenants || tenants.length === 0) return 'No tenants'
  const activeTenants = tenants.filter(t => t.status === 'active')
  if (activeTenants.length === 0) return 'No active tenants'
  if (activeTenants.length === 1) {
    return `${activeTenants[0].first_name} ${activeTenants[0].last_name}`
  }
  return `${activeTenants[0].first_name} ${activeTenants[0].last_name} + ${activeTenants.length - 1} more`
}

// Fetch property activity/audit log
const fetchActivity = async () => {
  if (!property.value) return

  loadingActivity.value = true
  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const response = await authFetch(`${API_URL}/api/properties/${property.value.id}/activity`, { token })

    if (!response.ok) {
      throw new Error('Failed to fetch activity')
    }

    const data = await response.json()
    activities.value = data.activities || []
  } catch (err: any) {
    console.error('Failed to fetch activity:', err)
    toast.error('Failed to load activity')
  } finally {
    loadingActivity.value = false
  }
}

// Format activity date
const formatActivityDate = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    if (diffHours === 0) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60))
      return diffMinutes <= 1 ? 'Just now' : `${diffMinutes} minutes ago`
    }
    return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`
  } else if (diffDays === 1) {
    return 'Yesterday'
  } else if (diffDays < 7) {
    return `${diffDays} days ago`
  } else {
    return formatDate(dateString)
  }
}

// Get clickable link for activity
const getActivityLink = (activity: any) => {
  if (!activity.metadata) return null

  // Check if activity has reference_id, offer_id, or agreement_id
  if (activity.metadata.reference_id) return `/references/${activity.metadata.reference_id}`
  if (activity.metadata.offer_id) return `/tenant-offers/${activity.metadata.offer_id}`
  if (activity.metadata.agreement_id) return `/agreements/${activity.metadata.agreement_id}`

  return null
}

// Navigate to activity item
const navigateToActivity = (activity: any) => {
  const link = getActivityLink(activity)
  if (link) {
    window.location.href = link
  }
}

const downloadDocument = (doc: PropertyDocument, forceDownload = false) => {
  try {
    // Use different endpoint for compliance documents vs property documents
    let path: string
    if (doc.source === 'compliance' && doc.compliance_record_id) {
      path = `/api/properties/${property.value?.id}/compliance/${doc.compliance_record_id}/document/${doc.id}`
    } else {
      path = `/api/properties/${property.value?.id}/documents/${doc.id}/download`
    }

    if (forceDownload) {
      // Force download using Safari-safe method
      downloadFile(path, doc.file_name)
    } else {
      // Open in new tab for viewing using Safari-safe method
      openInNewTab(path)
    }
  } catch (err) {
    toast.error('Failed to download document')
  }
}

const openDocumentPreview = async (doc: PropertyDocument) => {
  previewDocument.value = doc
  showDocumentPreview.value = true
  previewLoading.value = true
  previewUrl.value = null

  try {
    // Use different endpoint for compliance documents vs property documents
    let url: string
    if (doc.source === 'compliance' && doc.compliance_record_id) {
      url = `${API_URL}/api/properties/${property.value?.id}/compliance/${doc.compliance_record_id}/document/${doc.id}`
    } else {
      url = `${API_URL}/api/properties/${property.value?.id}/documents/${doc.id}/download`
    }

    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const response = await authFetch(url, { token })

    if (!response.ok) throw new Error('Failed to load document')

    const blob = await response.blob()
    previewUrl.value = window.URL.createObjectURL(blob)
  } catch (err) {
    toast.error('Failed to load document preview')
    closeDocumentPreview()
  } finally {
    previewLoading.value = false
  }
}

const closeDocumentPreview = () => {
  if (previewUrl.value) {
    window.URL.revokeObjectURL(previewUrl.value)
  }
  showDocumentPreview.value = false
  previewDocument.value = null
  previewUrl.value = null
}

const getComplianceBorderClass = (status: string) => {
  switch (status) {
    case 'valid': return 'border-green-200 bg-green-50 dark:border-green-700 dark:bg-green-900/30'
    case 'expiring_soon': return 'border-amber-200 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/30'
    case 'expired': return 'border-red-200 bg-red-50 dark:border-red-700 dark:bg-red-900/30'
    default: return 'border-gray-200 bg-gray-50 dark:border-slate-600 dark:bg-slate-700/50'
  }
}

const getComplianceDotClass = (status: string) => {
  switch (status) {
    case 'valid': return 'bg-green-500'
    case 'expiring_soon': return 'bg-amber-500'
    case 'expired': return 'bg-red-500'
    default: return 'bg-gray-500'
  }
}

const formatComplianceType = (type: string) => {
  const types: Record<string, string> = {
    'gas_safety': 'Gas Safety',
    'eicr': 'EICR',
    'epc': 'EPC',
    'council_licence': 'Council Licence',
    'pat_test': 'PAT Test',
    'other': 'Other'
  }
  return types[type] || type
}

const formatPropertyType = (type: string | null) => {
  if (!type) return null
  const types: Record<string, string> = {
    'house': 'House',
    'flat': 'Flat',
    'studio': 'Studio',
    'room': 'Room',
    'bungalow': 'Bungalow',
    'maisonette': 'Maisonette',
    'other': 'Other'
  }
  return types[type] || type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

const formatFurnishing = (status: string | null) => {
  if (!status) return null
  const statuses: Record<string, string> = {
    'furnished': 'Furnished',
    'part_furnished': 'Part Furnished',
    'unfurnished': 'Unfurnished'
  }
  return statuses[status] || status
}

const formatManagementType = (type: string | null) => {
  if (!type) return null
  const types: Record<string, string> = {
    'managed': 'Managed',
    'let_only': 'Let Only'
  }
  return types[type] || type
}

const formatDocumentTag = (tag: string) => {
  const tags: Record<string, string> = {
    'gas': 'Gas',
    'epc': 'EPC',
    'agreement': 'Agreement',
    'reference': 'Reference',
    'inventory': 'Inventory',
    'other': 'Other'
  }
  return tags[tag] || tag
}

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
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

const loadApex27Status = async () => {
  try {
    const token = authStore.session?.access_token
    const response = await authFetch(`${API_URL}/api/settings/apex27`, { token })
    if (response.ok) {
      const data = await response.json()
      apex27Connected.value = data.configured && data.lastTestStatus === 'success'
    }
  } catch {
    // Silently fail
  }
}

const pushPropertyDocToApex27 = async (docId: string) => {
  pushingDocId.value = docId
  try {
    const token = authStore.session?.access_token
    const response = await authFetch(`${API_URL}/api/apex27/documents/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceType: 'property_document', sourceId: docId }),
      token
    })

    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Failed to push document')

    // Simple success feedback
    alert('Document pushed to Apex27')
  } catch (err: any) {
    console.error('[PropertyDetail] Error pushing to Apex27:', err)
    alert(err.message || 'Failed to push to Apex27')
  } finally {
    pushingDocId.value = null
  }
}

onMounted(() => {
  fetchProperty()
  loadApex27Status()
})
</script>
