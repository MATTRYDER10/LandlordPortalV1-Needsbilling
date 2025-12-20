<template>
  <Sidebar>
    <div class="h-screen flex flex-col bg-gray-50">
      <!-- Top Bar -->
      <ReferencesTopBar
        v-model:search="search"
        v-model:sortBy="sortBy"
        v-model:sortOrder="sortOrder"
        @refresh="loadTenancies"
        @create="showCreateModal = true"
      />

      <!-- Status Tabs -->
      <ReferencesStatusTabs
        v-model="activeTab"
        :counts="statusCounts"
      />

      <!-- Main Content -->
      <div class="flex-1 overflow-y-auto">
        <!-- Loading State -->
        <div v-if="loading" class="p-6">
          <div class="bg-white rounded-lg shadow divide-y divide-gray-100">
            <div v-for="i in 5" :key="i" class="px-6 py-4">
              <div class="animate-pulse">
                <div class="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div class="h-3 bg-gray-100 rounded w-1/2 mb-2"></div>
                <div class="h-3 bg-gray-100 rounded w-1/3"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Tenancy List -->
        <div v-else-if="filteredTenancies.length > 0" class="px-6 py-4">
          <TenancyRow
            v-for="tenancy in filteredTenancies"
            :key="tenancy.id"
            :tenancy="tenancy"
            :isExpanded="expandedTenancyId === tenancy.id"
            @toggle="toggleExpanded(tenancy.id)"
            @openPerson="(person) => openPersonDrawer(person, tenancy)"
            @chase="handleChase"
            @addGuarantor="handleAddGuarantor(tenancy)"
          />
        </div>

        <!-- Empty State -->
        <div v-else class="p-6">
          <div class="bg-white rounded-lg shadow p-12 text-center">
            <FileText class="mx-auto h-12 w-12 text-gray-400" />
            <h3 class="mt-2 text-sm font-medium text-gray-900">
              {{ search ? 'No references found' : 'No references yet' }}
            </h3>
            <p class="mt-1 text-sm text-gray-500">
              {{ search ? 'Try adjusting your search terms.' : 'Get started by creating a new tenant reference.' }}
            </p>
            <div v-if="!search" class="mt-6">
              <button
                @click="showCreateModal = true"
                class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md"
              >
                Create New Reference
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Person Drawer -->
      <PersonDrawer
        v-model:open="drawerOpen"
        :person="selectedPerson"
        :tenancy="selectedTenancy"
        @updated="loadTenancies"
        @addGuarantor="handleAddGuarantorFromDrawer"
      />
    </div>

    <!-- Create Reference Modal -->
    <div v-if="showCreateModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-lg max-w-6xl w-full mx-4 max-h-[90vh] flex flex-col">
        <div class="p-6 pb-4">
          <h3 class="text-lg font-semibold text-gray-900">Create New Reference</h3>
        </div>
        <form @submit.prevent="handleCreate" class="flex flex-col flex-1 min-h-0">
          <div class="px-6 overflow-y-auto flex-1 space-y-4">
            <!-- Tenant Count Selector -->
            <div>
              <label for="tenant-count" class="block text-sm font-medium text-gray-700 mb-2">Number of Tenants *</label>
              <select id="tenant-count" v-model.number="tenantCount" @change="updateTenantCount(tenantCount)"
                class="block w-1/3 px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary">
                <option :value="1">1 Tenant</option>
                <option :value="2">2 Tenants</option>
                <option :value="3">3 Tenants</option>
                <option :value="4">4 Tenants</option>
                <option :value="5">5 Tenants</option>
                <option :value="6">6 Tenants</option>
                <option :value="7">7 Tenants</option>
                <option :value="8">8 Tenants</option>
                <option :value="9">9 Tenants</option>
                <option :value="10">10 Tenants</option>
                <option :value="11">11 Tenants</option>
                <option :value="12">12 Tenants</option>
                <option :value="13">13 Tenants</option>
                <option :value="14">14 Tenants</option>
                <option :value="15">15 Tenants</option>
              </select>
            </div>

            <!-- Property Information (shown once) -->
            <div>
              <h4 class="text-md font-semibold text-gray-700 mb-3">Property Information</h4>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <AddressAutocomplete v-model="formData.property_address" label="Property Address" :required="true"
                    id="address" placeholder="Start typing address..."
                    @addressSelected="handlePropertyAddressSelected" />
                </div>
                <div>
                  <label for="city" class="block text-sm font-medium text-gray-700">City *</label>
                  <input id="city" v-model="formData.property_city" type="text" required
                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary" />
                </div>
                <div>
                  <label for="postcode" class="block text-sm font-medium text-gray-700">Postcode *</label>
                  <input id="postcode" v-model="formData.property_postcode" type="text" required
                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary" />
                </div>
                <div>
                  <label for="rent" class="block text-sm font-medium text-gray-700">Total Monthly Rent (£) *</label>
                  <input id="rent" v-model.number="formData.monthly_rent" type="number" step="1" required
                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary" />
                </div>
              </div>
            </div>

            <!-- Single Tenant Information (v-if tenantCount === 1) -->
            <div v-if="tenantCount === 1">
              <h4 class="text-md font-semibold text-gray-700 mb-3">Tenant Information</h4>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label for="first-name" class="block text-sm font-medium text-gray-700">First Name *</label>
                  <input id="first-name" v-model="formData.tenant_first_name" type="text" required
                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary" />
                </div>
                <div>
                  <label for="last-name" class="block text-sm font-medium text-gray-700">Last Name *</label>
                  <input id="last-name" v-model="formData.tenant_last_name" type="text" required
                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary" />
                </div>
                <div>
                  <label for="email" class="block text-sm font-medium text-gray-700">Email *</label>
                  <input id="email" v-model="formData.tenant_email" type="email" required
                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary" />
                </div>
                <div>
                  <PhoneInput v-model="formData.tenant_phone" label="Phone" id="phone" :required="true" />
                </div>
              </div>

              <!-- Guarantor for single tenant -->
              <div class="mt-4 pt-4 border-t border-gray-200">
                <div class="flex items-center justify-between mb-3">
                  <h5 class="text-sm font-semibold text-gray-700">Add Guarantor (Optional)</h5>
                  <button type="button" @click="showGuarantorFields = !showGuarantorFields"
                    class="text-sm text-primary hover:underline">
                    {{ showGuarantorFields ? 'Hide' : 'Show' }}
                  </button>
                </div>

                <div v-if="showGuarantorFields" class="space-y-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p class="text-sm text-gray-600">Add guarantor details. They will receive an email to complete the
                    reference form.</p>

                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label for="guarantor-first-name" class="block text-sm font-medium text-gray-700">First
                        Name</label>
                      <input id="guarantor-first-name" v-model="formData.guarantor_first_name" type="text"
                        class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary" />
                    </div>
                    <div>
                      <label for="guarantor-last-name" class="block text-sm font-medium text-gray-700">Last Name</label>
                      <input id="guarantor-last-name" v-model="formData.guarantor_last_name" type="text"
                        class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary" />
                    </div>
                    <div>
                      <label for="guarantor-email" class="block text-sm font-medium text-gray-700">Email</label>
                      <input id="guarantor-email" v-model="formData.guarantor_email" type="email"
                        class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary" />
                    </div>
                    <div>
                      <PhoneInput v-model="formData.guarantor_phone" label="Phone" id="guarantor-phone"
                        :required="false" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Multiple Tenants (v-if tenantCount > 1) -->
            <div v-if="tenantCount > 1">
              <h4 class="text-md font-semibold text-gray-700 mb-3">Tenants</h4>
              <div v-for="(tenant, index) in tenants" :key="index"
                class="mb-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
                <h5 class="text-sm font-semibold text-gray-700 mb-3">Tenant {{ index + 1 }}</h5>
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label :for="`tenant-${index}-first-name`" class="block text-sm font-medium text-gray-700">First
                      Name *</label>
                    <input :id="`tenant-${index}-first-name`" v-model="tenant.first_name" type="text" required
                      class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary" />
                  </div>
                  <div>
                    <label :for="`tenant-${index}-last-name`" class="block text-sm font-medium text-gray-700">Last Name
                      *</label>
                    <input :id="`tenant-${index}-last-name`" v-model="tenant.last_name" type="text" required
                      class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary" />
                  </div>
                  <div>
                    <label :for="`tenant-${index}-email`" class="block text-sm font-medium text-gray-700">Email
                      *</label>
                    <input :id="`tenant-${index}-email`" v-model="tenant.email" type="email" required
                      class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary" />
                  </div>
                  <div>
                    <PhoneInput v-model="tenant.phone" :label="`Phone`" :id="`tenant-${index}-phone`"
                      :required="true" />
                  </div>
                  <div class="col-span-2">
                    <label :for="`tenant-${index}-rent-share`" class="block text-sm font-medium text-gray-700">Rent
                      Share (£) *</label>
                    <input :id="`tenant-${index}-rent-share`" v-model.number="tenant.rent_share" type="number"
                      step="0.01" required
                      class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                      placeholder="0.00" />
                  </div>
                </div>

                <!-- Guarantor for this tenant -->
                <div class="mt-3 pt-3 border-t border-gray-300">
                  <div class="flex items-center justify-between mb-2">
                    <h6 class="text-sm font-medium text-gray-700">Add Guarantor (Optional)</h6>
                    <button type="button" @click="tenant.showGuarantorFields = !tenant.showGuarantorFields"
                      class="text-xs text-primary hover:underline">
                      {{ tenant.showGuarantorFields ? 'Hide' : 'Show' }}
                    </button>
                  </div>

                  <div v-if="tenant.showGuarantorFields"
                    class="space-y-3 p-3 bg-white rounded-lg border border-gray-200">
                    <p class="text-xs text-gray-600">Add guarantor details for this tenant. They will receive an email
                      to complete the reference form.</p>

                    <div class="grid grid-cols-2 gap-3">
                      <div>
                        <label :for="`tenant-${index}-guarantor-first-name`"
                          class="block text-xs font-medium text-gray-700">First Name</label>
                        <input :id="`tenant-${index}-guarantor-first-name`" :value="tenant.guarantor?.first_name || ''"
                          @input="(e: Event) => { const target = e.target as HTMLInputElement; if (!tenant.guarantor) tenant.guarantor = { first_name: '', last_name: '', email: '', phone: '' }; tenant.guarantor.first_name = target.value }"
                          type="text"
                          class="mt-1 block w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-primary focus:border-primary" />
                      </div>
                      <div>
                        <label :for="`tenant-${index}-guarantor-last-name`"
                          class="block text-xs font-medium text-gray-700">Last Name</label>
                        <input :id="`tenant-${index}-guarantor-last-name`" :value="tenant.guarantor?.last_name || ''"
                          @input="(e: Event) => { const target = e.target as HTMLInputElement; if (!tenant.guarantor) tenant.guarantor = { first_name: '', last_name: '', email: '', phone: '' }; tenant.guarantor.last_name = target.value }"
                          type="text"
                          class="mt-1 block w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-primary focus:border-primary" />
                      </div>
                      <div>
                        <label :for="`tenant-${index}-guarantor-email`"
                          class="block text-xs font-medium text-gray-700">Email</label>
                        <input :id="`tenant-${index}-guarantor-email`" :value="tenant.guarantor?.email || ''"
                          @input="(e: Event) => { const target = e.target as HTMLInputElement; if (!tenant.guarantor) tenant.guarantor = { first_name: '', last_name: '', email: '', phone: '' }; tenant.guarantor.email = target.value }"
                          type="email"
                          class="mt-1 block w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-primary focus:border-primary" />
                      </div>
                      <div>
                        <label :for="`tenant-${index}-guarantor-phone`"
                          class="block text-xs font-medium text-gray-700">Phone</label>
                        <PhoneInput :modelValue="tenant.guarantor?.phone || ''"
                          @update:modelValue="(val) => { if (!tenant.guarantor) tenant.guarantor = { first_name: '', last_name: '', email: '', phone: '' }; tenant.guarantor.phone = val }"
                          :id="`tenant-${index}-guarantor-phone`" :required="false"
                          input-class="px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                          select-class="px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-primary focus:border-primary" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Rent Calculator -->
              <div class="p-4 rounded-lg"
                :class="rentSharesValid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'">
                <div class="flex justify-between items-center">
                  <span class="text-sm font-medium" :class="rentSharesValid ? 'text-green-900' : 'text-red-900'">
                    Total Rent Shares:
                  </span>
                  <span class="text-lg font-bold" :class="rentSharesValid ? 'text-green-900' : 'text-red-900'">
                    £{{ totalRentShare.toFixed(2) }} / £{{ Number(formData.monthly_rent || 0).toFixed(2) }}
                  </span>
                </div>
                <p v-if="!rentSharesValid" class="text-xs text-red-700 mt-2">
                  Rent shares must sum exactly to the total monthly rent
                </p>
                <p v-else class="text-xs text-green-700 mt-2">
                  Rent shares match total rent
                </p>
              </div>
            </div>

            <!-- Move-in Date & Term Length Grid -->
            <div class="grid grid-cols-2 gap-6">
              <div>
                <DatePicker v-model="formData.move_in_date" label="Move-in Date" :required="true"
                  year-range-type="move-in" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Term Length</label>
                <div class="grid grid-cols-2 gap-3">
                  <div class="flex items-center gap-2">
                    <label for="term-years" class="text-sm text-gray-600 whitespace-nowrap">Years</label>
                    <input id="term-years" v-model.number="formData.term_years" type="number" min="0"
                      class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                      placeholder="0" />
                  </div>
                  <div class="flex items-center gap-2">
                    <label for="term-months" class="text-sm text-gray-600 whitespace-nowrap">Months</label>
                    <input id="term-months" v-model.number="formData.term_months" type="number" min="0" max="11"
                      class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                      placeholder="0" />
                  </div>
                </div>
              </div>
            </div>

            <!-- Internal Notes -->
            <div>
              <label for="notes" class="block text-sm font-medium text-gray-700">Internal Notes</label>
              <textarea id="notes" v-model="formData.notes" rows="2"
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                placeholder="Optional internal notes about this reference..."></textarea>
            </div>

            <div v-if="createError" class="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
              {{ createError }}
            </div>

          </div>

          <!-- Sticky Footer with Buttons -->
          <div class="p-6 pt-4 border-t border-gray-200 bg-white rounded-b-lg">
            <div class="flex justify-end space-x-3">
              <button type="button" @click="closeCreateModal"
                class="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md">
                Cancel
              </button>
              <button type="submit" :disabled="createLoading"
                class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md disabled:opacity-50">
                {{ createLoading ? 'Creating...' : 'Create Reference' }}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>

    <!-- Insufficient Credits Modal -->
    <InsufficientCreditsModal v-if="showInsufficientCreditsModal" @close="showInsufficientCreditsModal = false"
      @purchased="handleCreditsPurchased" />

    <!-- Payment Method Required Modal -->
    <PaymentMethodRequiredModal :show="showPaymentMethodModal" @close="showPaymentMethodModal = false" />

    <!-- Delete Confirmation Modal -->
    <div v-if="showDeleteModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-lg max-w-md w-full p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Delete Reference</h3>
        <p class="text-sm text-gray-600 mb-6">
          Are you sure you want to delete the reference for
          <span class="font-medium">{{ referenceToDelete?.name }}</span>?
          This action cannot be undone.
        </p>
        <div class="flex justify-end space-x-3">
          <button @click="showDeleteModal = false"
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
            Cancel
          </button>
          <button @click="handleDelete" :disabled="deleteLoading"
            class="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md disabled:opacity-50">
            {{ deleteLoading ? 'Deleting...' : 'Delete' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Add Guarantor Modal -->
    <div v-if="showAddGuarantorModal"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-lg max-w-md w-full p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Add Guarantor</h3>

        <!-- Tenant Selection (if multiple tenants) -->
        <div v-if="tenantsForGuarantor.length > 1" class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-2">Select Tenant *</label>
          <select v-model="selectedTenantForGuarantor"
            class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary">
            <option value="">Select a tenant</option>
            <option v-for="tenant in tenantsForGuarantor" :key="tenant.id" :value="tenant.id">
              {{ tenant.name }}
            </option>
          </select>
        </div>

        <form @submit.prevent="addGuarantor" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700">First Name *</label>
            <input v-model="guarantorForm.first_name" type="text" required
              class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary" />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700">Last Name *</label>
            <input v-model="guarantorForm.last_name" type="text" required
              class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary" />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700">Email *</label>
            <input v-model="guarantorForm.email" type="email" required
              class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary" />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700">Phone</label>
            <input v-model="guarantorForm.phone" type="tel"
              class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary" />
          </div>

          <div v-if="guarantorError" class="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded text-sm">
            {{ guarantorError }}
          </div>

          <div v-if="guarantorSuccess"
            class="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded text-sm">
            {{ guarantorSuccess }}
          </div>

          <div class="flex justify-end space-x-3 pt-4">
            <button type="button" @click="closeGuarantorModal"
              class="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md">
              Cancel
            </button>
            <button type="submit" :disabled="addingGuarantor || (tenantsForGuarantor.length > 1 && !selectedTenantForGuarantor)"
              class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md disabled:opacity-50">
              {{ addingGuarantor ? 'Adding...' : 'Add Guarantor' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Sidebar>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useToast } from 'vue-toastification'
import { useAuthStore } from '../stores/auth'
import Sidebar from '../components/Sidebar.vue'
import PhoneInput from '../components/PhoneInput.vue'
import DatePicker from '../components/DatePicker.vue'
import AddressAutocomplete from '../components/AddressAutocomplete.vue'
import InsufficientCreditsModal from '../components/InsufficientCreditsModal.vue'
import PaymentMethodRequiredModal from '../components/PaymentMethodRequiredModal.vue'
import ReferencesTopBar from '../components/references/ReferencesTopBar.vue'
import ReferencesStatusTabs from '../components/references/ReferencesStatusTabs.vue'
import TenancyRow from '../components/references/TenancyRow.vue'
import PersonDrawer from '../components/references/PersonDrawer.vue'
import { useTenancies, type Tenancy, type TenancyPerson, type TenancyStatus } from '../composables/useTenancies'
import { isValidEmail } from '../utils/validation'
import { FileText } from 'lucide-vue-next'

const router = useRouter()
const route = useRoute()
const toast = useToast()
const authStore = useAuthStore()

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

// Use the tenancies composable
const {
  tenancies,
  statusCounts,
  loading,
  loadTenancies,
  expandedTenancyId,
  toggleExpanded,
  selectedPerson,
  selectedTenancy,
  drawerOpen,
  openPersonDrawer
} = useTenancies()

// Local state
const search = ref('')
const sortBy = ref<'move_in_date' | 'created_at'>('move_in_date')
const sortOrder = ref<'asc' | 'desc'>('asc')
const activeTab = ref<TenancyStatus | 'ALL'>('ALL')

// Create modal state
const showCreateModal = ref(false)
const showGuarantorFields = ref(false)
const showInsufficientCreditsModal = ref(false)
const showPaymentMethodModal = ref(false)
const createLoading = ref(false)
const createError = ref('')

// Delete modal state
const showDeleteModal = ref(false)
const referenceToDelete = ref<TenancyPerson | null>(null)
const deleteLoading = ref(false)

// Add Guarantor modal state
const showAddGuarantorModal = ref(false)
const addingGuarantor = ref(false)
const guarantorError = ref('')
const guarantorSuccess = ref('')
const selectedTenantForGuarantor = ref('')
const tenancyForGuarantor = ref<Tenancy | null>(null)
const guarantorForm = ref({
  first_name: '',
  last_name: '',
  email: '',
  phone: ''
})

// Multi-tenant form state
const tenantCount = ref(1)
const previousTenantCount = ref(1)
const tenants = ref<Array<{
  first_name: string
  last_name: string
  email: string
  phone: string
  rent_share: number | null
  guarantor?: {
    first_name: string
    last_name: string
    email: string
    phone: string
  } | null
  showGuarantorFields?: boolean
}>>([{
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  rent_share: null,
  guarantor: null,
  showGuarantorFields: false
}])

const formData = ref({
  tenant_first_name: '',
  tenant_last_name: '',
  tenant_email: '',
  tenant_phone: '',
  property_address: '',
  property_city: '',
  property_postcode: '',
  monthly_rent: null as number | null,
  move_in_date: '',
  term_years: 0,
  term_months: 0,
  notes: '',
  guarantor_first_name: '',
  guarantor_last_name: '',
  guarantor_email: '',
  guarantor_phone: ''
})

// Computed
const filteredTenancies = computed(() => {
  let filtered = tenancies.value

  // Filter by status tab
  if (activeTab.value !== 'ALL') {
    filtered = filtered.filter(t => t.tenancyStatus === activeTab.value)
  }

  // Filter by search
  if (search.value.trim()) {
    const query = search.value.toLowerCase().trim()
    filtered = filtered.filter(t => {
      const address = t.propertyAddress.toLowerCase()
      const city = (t.propertyCity || '').toLowerCase()
      const postcode = (t.propertyPostcode || '').toLowerCase()
      const peopleMatch = t.people.some(p =>
        p.name.toLowerCase().includes(query) ||
        p.email.toLowerCase().includes(query)
      )
      return address.includes(query) ||
             city.includes(query) ||
             postcode.includes(query) ||
             peopleMatch
    })
  }

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    let aValue: number
    let bValue: number

    if (sortBy.value === 'move_in_date') {
      aValue = a.moveInDate ? new Date(a.moveInDate).getTime() : 0
      bValue = b.moveInDate ? new Date(b.moveInDate).getTime() : 0
    } else {
      aValue = a.createdAt ? new Date(a.createdAt).getTime() : 0
      bValue = b.createdAt ? new Date(b.createdAt).getTime() : 0
    }

    return sortOrder.value === 'asc' ? aValue - bValue : bValue - aValue
  })

  return sorted
})

const totalRentShare = computed(() => {
  return tenants.value.reduce((sum, t) => sum + (Number(t.rent_share) || 0), 0)
})

const rentSharesValid = computed(() => {
  if (tenantCount.value === 1) return true
  const total = totalRentShare.value
  const monthlyRent = Number(formData.value.monthly_rent) || 0
  return Math.abs(total - monthlyRent) < 0.01 && monthlyRent > 0
})

// Get tenants without guarantors for the selected tenancy
const tenantsForGuarantor = computed(() => {
  if (!tenancyForGuarantor.value) return []
  // Get IDs of tenants who already have guarantors
  const guarantorForTenantIds = tenancyForGuarantor.value.people
    .filter(p => p.role === 'GUARANTOR' && p.guarantorForTenantId)
    .map(p => p.guarantorForTenantId)
  // Return tenants who don't already have a guarantor
  return tenancyForGuarantor.value.people
    .filter(p => p.role === 'TENANT' && !guarantorForTenantIds.includes(p.id))
})

// Watchers
watch(() => formData.value.monthly_rent, () => {
  distributeRentEvenly()
})

// Methods
const distributeRentEvenly = () => {
  if (tenantCount.value <= 1) return
  const monthlyRent = Number(formData.value.monthly_rent) || 0
  if (monthlyRent <= 0) return

  const sharePerTenant = Math.floor((monthlyRent / tenantCount.value) * 100) / 100
  const remainder = Math.round((monthlyRent - (sharePerTenant * tenantCount.value)) * 100) / 100

  tenants.value.forEach((tenant, index) => {
    tenant.rent_share = index === 0
      ? Math.round((sharePerTenant + remainder) * 100) / 100
      : sharePerTenant
  })
}

const updateTenantCount = (count: number) => {
  const previousCount = previousTenantCount.value
  tenantCount.value = count

  if (previousCount === 1 && count > 1) {
    tenants.value[0] = {
      first_name: formData.value.tenant_first_name,
      last_name: formData.value.tenant_last_name,
      email: formData.value.tenant_email,
      phone: formData.value.tenant_phone,
      rent_share: null,
      guarantor: (formData.value.guarantor_first_name || formData.value.guarantor_email) ? {
        first_name: formData.value.guarantor_first_name,
        last_name: formData.value.guarantor_last_name,
        email: formData.value.guarantor_email,
        phone: formData.value.guarantor_phone
      } : null,
      showGuarantorFields: showGuarantorFields.value
    }
  }

  if (previousCount > 1 && count === 1) {
    formData.value.tenant_first_name = tenants.value[0]?.first_name || ''
    formData.value.tenant_last_name = tenants.value[0]?.last_name || ''
    formData.value.tenant_email = tenants.value[0]?.email || ''
    formData.value.tenant_phone = tenants.value[0]?.phone || ''

    if (tenants.value[0]?.guarantor) {
      formData.value.guarantor_first_name = tenants.value[0].guarantor.first_name || ''
      formData.value.guarantor_last_name = tenants.value[0].guarantor.last_name || ''
      formData.value.guarantor_email = tenants.value[0].guarantor.email || ''
      formData.value.guarantor_phone = tenants.value[0].guarantor.phone || ''
      showGuarantorFields.value = true
    }
  }

  while (tenants.value.length < count) {
    tenants.value.push({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      rent_share: null,
      guarantor: null,
      showGuarantorFields: false
    })
  }
  while (tenants.value.length > count) {
    tenants.value.pop()
  }

  distributeRentEvenly()
  previousTenantCount.value = count
}

const handlePropertyAddressSelected = (addressData: any) => {
  formData.value.property_address = addressData.addressLine1
  formData.value.property_city = addressData.city
  formData.value.property_postcode = addressData.postcode
}

const handleCreate = async () => {
  createLoading.value = true
  createError.value = ''

  try {
    const token = authStore.session?.access_token
    if (!token) {
      createError.value = 'No auth token available'
      return
    }

    if (!formData.value.move_in_date) {
      createError.value = 'Move-in date is required'
      createLoading.value = false
      return
    }

    // Validate emails
    if (tenantCount.value === 1) {
      if (!isValidEmail(formData.value.tenant_email)) {
        createError.value = 'Please enter a valid tenant email address'
        createLoading.value = false
        return
      }
      if (formData.value.guarantor_email && !isValidEmail(formData.value.guarantor_email)) {
        createError.value = 'Please enter a valid guarantor email address'
        createLoading.value = false
        return
      }
    } else {
      for (let i = 0; i < tenants.value.length; i++) {
        const tenant = tenants.value[i]
        if (!isValidEmail(tenant?.email || '')) {
          createError.value = `Please enter a valid email address for tenant ${i + 1}`
          createLoading.value = false
          return
        }
        if (tenant?.guarantor?.email && !isValidEmail(tenant.guarantor.email)) {
          createError.value = `Please enter a valid email address for guarantor of tenant ${i + 1}`
          createLoading.value = false
          return
        }
      }
    }

    let payload: any

    if (tenantCount.value === 1) {
      payload = { ...formData.value }
    } else {
      if (!rentSharesValid.value) {
        createError.value = 'Rent shares must sum to the total monthly rent'
        createLoading.value = false
        return
      }

      payload = {
        tenants: tenants.value,
        property_address: formData.value.property_address,
        property_city: formData.value.property_city,
        property_postcode: formData.value.property_postcode,
        monthly_rent: formData.value.monthly_rent,
        move_in_date: formData.value.move_in_date,
        term_years: formData.value.term_years,
        term_months: formData.value.term_months,
        notes: formData.value.notes
      }
    }

    const response = await fetch(`${API_URL}/api/references`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      if (response.status === 402) {
        const errorData = await response.json()
        closeCreateModal()

        if (errorData.requires_payment_method || errorData.error === 'Payment Method Required') {
          showPaymentMethodModal.value = true
        } else {
          showInsufficientCreditsModal.value = true
        }
        return
      }

      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to create reference')
    }

    const successMessage = tenantCount.value > 1
      ? `Reference created successfully for ${tenantCount.value} tenants!`
      : 'Reference created successfully!'
    toast.success(successMessage)

    closeCreateModal()
    loadTenancies()
  } catch (error: any) {
    createError.value = error.message || 'Failed to create reference'
  } finally {
    createLoading.value = false
  }
}

const closeCreateModal = () => {
  showCreateModal.value = false
  tenantCount.value = 1
  previousTenantCount.value = 1
  tenants.value = [{
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    rent_share: null,
    guarantor: null,
    showGuarantorFields: false
  }]
  formData.value = {
    tenant_first_name: '',
    tenant_last_name: '',
    tenant_email: '',
    tenant_phone: '',
    property_address: '',
    property_city: '',
    property_postcode: '',
    monthly_rent: null,
    move_in_date: '',
    term_years: 0,
    term_months: 0,
    notes: '',
    guarantor_first_name: '',
    guarantor_last_name: '',
    guarantor_email: '',
    guarantor_phone: ''
  }
  showGuarantorFields.value = false
  createError.value = ''
}

const handleCreditsPurchased = () => {
  showInsufficientCreditsModal.value = false
  showCreateModal.value = true
}

const handleChase = async (person: TenancyPerson) => {
  try {
    const token = authStore.session?.access_token
    if (!token) {
      toast.error('No auth token available')
      return
    }

    // Get chase dependencies for this person
    const depsResponse = await fetch(`${API_URL}/api/chase/agent/reference/${person.id}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!depsResponse.ok) {
      throw new Error('Failed to get chase dependencies')
    }

    const { dependencies } = await depsResponse.json()

    // Chase all available dependencies
    let chaseCount = 0
    let earliestCooldownEnd: Date | null = null

    for (const dep of dependencies) {
      if (dep.canChase) {
        const chaseResponse = await fetch(`${API_URL}/api/chase/agent/${dep.id}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })

        if (chaseResponse.ok) {
          chaseCount++
        }
      } else if (dep.cooldownEnds) {
        // Track earliest cooldown end time
        const cooldownEnd = new Date(dep.cooldownEnds)
        if (!earliestCooldownEnd || cooldownEnd < earliestCooldownEnd) {
          earliestCooldownEnd = cooldownEnd
        }
      }
    }

    if (chaseCount > 0) {
      toast.success(`Chase sent for ${chaseCount} outstanding item(s)`)
    } else if (earliestCooldownEnd) {
      // Show when the cooldown ends
      const now = new Date()
      const diffMs = earliestCooldownEnd.getTime() - now.getTime()
      const diffMins = Math.ceil(diffMs / (1000 * 60))

      if (diffMins > 60) {
        const hours = Math.floor(diffMins / 60)
        const mins = diffMins % 60
        toast.info(`Chase available again in ${hours}h ${mins}m`)
      } else {
        toast.info(`Chase available again in ${diffMins} minute${diffMins !== 1 ? 's' : ''}`)
      }
    } else {
      toast.info('No items available to chase at this time')
    }
  } catch (error: any) {
    console.error('Failed to chase:', error)
    toast.error(error.message || 'Failed to send chase')
  }
}

const handleAddGuarantor = (tenancy: Tenancy) => {
  // Set the tenancy and reset form
  tenancyForGuarantor.value = tenancy
  guarantorForm.value = { first_name: '', last_name: '', email: '', phone: '' }
  guarantorError.value = ''
  guarantorSuccess.value = ''

  // Get tenants without guarantors
  const availableTenants = tenantsForGuarantor.value

  if (availableTenants.length === 0) {
    toast.info('All tenants in this tenancy already have guarantors')
    return
  }

  // Auto-select if only one tenant
  if (availableTenants.length === 1 && availableTenants[0]) {
    selectedTenantForGuarantor.value = availableTenants[0].id
  } else {
    selectedTenantForGuarantor.value = ''
  }

  showAddGuarantorModal.value = true
}

// Handler for when add guarantor is triggered from the PersonDrawer
const handleAddGuarantorFromDrawer = (tenantId: string) => {
  // Use the selectedTenancy which should still be set from the drawer
  if (!selectedTenancy.value) return

  // Set the tenancy and reset form
  tenancyForGuarantor.value = selectedTenancy.value
  guarantorForm.value = { first_name: '', last_name: '', email: '', phone: '' }
  guarantorError.value = ''
  guarantorSuccess.value = ''

  // Pre-select the tenant that was clicked
  selectedTenantForGuarantor.value = tenantId

  showAddGuarantorModal.value = true
}

const closeGuarantorModal = () => {
  showAddGuarantorModal.value = false
  tenancyForGuarantor.value = null
  selectedTenantForGuarantor.value = ''
  guarantorForm.value = { first_name: '', last_name: '', email: '', phone: '' }
  guarantorError.value = ''
  guarantorSuccess.value = ''
}

const addGuarantor = async () => {
  if (!tenancyForGuarantor.value) return

  // Validate tenant selection if multiple tenants
  const firstTenant = tenantsForGuarantor.value[0]
  const tenantId = tenantsForGuarantor.value.length === 1 && firstTenant
    ? firstTenant.id
    : selectedTenantForGuarantor.value

  if (!tenantId) {
    guarantorError.value = 'Please select a tenant'
    return
  }

  // Validate form
  if (!guarantorForm.value.first_name || !guarantorForm.value.last_name || !guarantorForm.value.email) {
    guarantorError.value = 'Please fill in all required fields'
    return
  }

  if (!isValidEmail(guarantorForm.value.email)) {
    guarantorError.value = 'Please enter a valid email address'
    return
  }

  addingGuarantor.value = true
  guarantorError.value = ''
  guarantorSuccess.value = ''

  try {
    const token = authStore.session?.access_token
    if (!token) {
      guarantorError.value = 'Not authenticated'
      return
    }

    const response = await fetch(`${API_URL}/api/references/${tenantId}/add-guarantor`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        guarantor_first_name: guarantorForm.value.first_name,
        guarantor_last_name: guarantorForm.value.last_name,
        guarantor_email: guarantorForm.value.email,
        guarantor_phone: guarantorForm.value.phone || null
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to add guarantor')
    }

    guarantorSuccess.value = 'Guarantor added successfully! An email has been sent to them.'
    await loadTenancies()

    // Close modal after a short delay
    setTimeout(() => {
      closeGuarantorModal()
    }, 1500)
  } catch (error: any) {
    console.error('Failed to add guarantor:', error)
    guarantorError.value = error.message || 'Failed to add guarantor'
  } finally {
    addingGuarantor.value = false
  }
}

const handleDelete = async () => {
  if (!referenceToDelete.value) return

  deleteLoading.value = true
  try {
    const token = authStore.session?.access_token
    if (!token) {
      console.error('No auth token available')
      return
    }

    const response = await fetch(`${API_URL}/api/references/${referenceToDelete.value.id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to delete reference')
    }

    showDeleteModal.value = false
    referenceToDelete.value = null
    await loadTenancies()
    toast.success('Reference deleted successfully')
  } catch (error: any) {
    console.error('Failed to delete reference:', error)
    toast.error(error.message || 'Failed to delete reference')
  } finally {
    deleteLoading.value = false
  }
}

// Event handlers
const handleOpenCreateModal = () => {
  showCreateModal.value = true
}

// URL sync for person drawer
const updateUrlWithPerson = (personId: string | null) => {
  const query = { ...route.query }
  if (personId) {
    query.person = personId
  } else {
    delete query.person
  }
  router.replace({ query })
}

// Watch drawer state to sync URL
watch(drawerOpen, (isOpen) => {
  if (isOpen && selectedPerson.value) {
    updateUrlWithPerson(selectedPerson.value.id)
  } else if (!isOpen) {
    updateUrlWithPerson(null)
  }
})

// Open drawer from URL param after tenancies load
const openDrawerFromUrl = () => {
  const personId = route.query.person
  if (personId && typeof personId === 'string') {
    // Find the person across all tenancies
    for (const tenancy of tenancies.value) {
      const person = tenancy.people.find(p => p.id === personId)
      if (person) {
        openPersonDrawer(person, tenancy)
        expandedTenancyId.value = tenancy.id
        return
      }
    }
  }
}

// Lifecycle
onMounted(async () => {
  await loadTenancies()

  // Check for person in URL after tenancies load
  openDrawerFromUrl()

  if (route.query.create === 'true') {
    showCreateModal.value = true
    router.replace('/references')
  }

  if (route.query.status && typeof route.query.status === 'string') {
    const status = route.query.status.toUpperCase()
    if (['IN_PROGRESS', 'AWAITING_VERIFICATION', 'ACTION_REQUIRED', 'COMPLETED', 'REJECTED'].includes(status)) {
      activeTab.value = status as TenancyStatus
    }
  }

  window.addEventListener('open-create-reference-modal', handleOpenCreateModal)
})

onUnmounted(() => {
  window.removeEventListener('open-create-reference-modal', handleOpenCreateModal)
})
</script>
