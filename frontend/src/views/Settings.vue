<template>
  <Sidebar>
    <div class="p-8">
      <div class="mb-8">
        <h2 class="text-3xl font-bold text-gray-900">Settings</h2>
        <p class="mt-2 text-gray-600">Manage your account, team, and company settings</p>
      </div>

      <!-- Tabs Layout -->
      <div class="flex gap-6">
        <!-- Vertical Tabs -->
        <nav class="w-64 flex-shrink-0">
          <div class="bg-white rounded-lg shadow p-2 space-y-1">
            <router-link
              v-for="tab in tabs"
              :key="tab.id"
              :to="`/settings/${tab.id}`"
              class="block w-full text-left px-4 py-3 rounded-md font-medium text-sm transition-colors"
              :class="activeTab === tab.id
                ? 'bg-primary text-white'
                : 'text-gray-700 hover:bg-gray-100'"
            >
              {{ tab.name }}
            </router-link>
          </div>
        </nav>

        <!-- Tab Content -->
        <div class="flex-1">
        <!-- Permission Denied Message -->
        <div v-if="!hasPermission(activeTab)" class="max-w-3xl">
          <div class="bg-white rounded-lg shadow p-8">
            <div class="flex items-center justify-center mb-6">
              <div class="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                <svg class="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
            </div>
            <h3 class="text-2xl font-bold text-gray-900 text-center mb-2">Access Denied</h3>
            <p class="text-gray-600 text-center mb-6">
              You don't have permission to access this section. Please contact your company owner or admin for access.
            </p>
            <div class="flex justify-center">
              <router-link
                to="/settings/profile"
                class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md"
              >
                Go to Profile
              </router-link>
            </div>
          </div>
        </div>

        <!-- Profile Tab -->
        <div v-else-if="activeTab === 'profile'" class="max-w-3xl">
          <div class="bg-white rounded-lg shadow p-6 mb-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">Personal Information</h3>
            <form @submit.prevent="handleUpdateProfile" class="space-y-4">
              <div>
                <label for="email" class="block text-sm font-medium text-gray-700">Email</label>
                <input
                  id="email"
                  v-model="profileData.email"
                  type="email"
                  disabled
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 cursor-not-allowed"
                />
                <p class="mt-1 text-sm text-gray-500">Email cannot be changed</p>
              </div>

              <div>
                <label for="full-name" class="block text-sm font-medium text-gray-700">Full Name</label>
                <input
                  id="full-name"
                  v-model="profileData.fullName"
                  type="text"
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                />
              </div>

              <div>
                <label for="phone" class="block text-sm font-medium text-gray-700">Phone Number</label>
                <input
                  id="phone"
                  v-model="profileData.phone"
                  type="tel"
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                />
              </div>

              <div v-if="profileSuccess" class="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded">
                {{ profileSuccess }}
              </div>

              <div v-if="profileError" class="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
                {{ profileError }}
              </div>

              <button
                type="submit"
                :disabled="profileLoading"
                class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md disabled:opacity-50"
              >
                {{ profileLoading ? 'Saving...' : 'Save Changes' }}
              </button>
            </form>
          </div>

          <div class="bg-white rounded-lg shadow p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">Change Password</h3>
            <form @submit.prevent="handleChangePassword" class="space-y-4">
              <div>
                <label for="new-password" class="block text-sm font-medium text-gray-700">New Password</label>
                <input
                  id="new-password"
                  v-model="passwordData.newPassword"
                  type="password"
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                  placeholder="At least 6 characters"
                />
              </div>

              <div>
                <label for="confirm-password" class="block text-sm font-medium text-gray-700">Confirm Password</label>
                <input
                  id="confirm-password"
                  v-model="passwordData.confirmPassword"
                  type="password"
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                  placeholder="Confirm new password"
                />
              </div>

              <div v-if="passwordSuccess" class="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded">
                {{ passwordSuccess }}
              </div>

              <div v-if="passwordError" class="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
                {{ passwordError }}
              </div>

              <button
                type="submit"
                :disabled="passwordLoading"
                class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md disabled:opacity-50"
              >
                {{ passwordLoading ? 'Updating...' : 'Update Password' }}
              </button>
            </form>
          </div>
        </div>

        <!-- Company Tab -->
        <div v-else-if="activeTab === 'company'" class="max-w-3xl">
          <div class="bg-white rounded-lg shadow p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">Company Information</h3>
            <form @submit.prevent="handleUpdateCompany" class="space-y-4">
              <div>
                <label for="company-name" class="block text-sm font-medium text-gray-700">Company Name</label>
                <input
                  id="company-name"
                  v-model="companyData.name"
                  type="text"
                  required
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                />
              </div>

              <div>
                <label for="address" class="block text-sm font-medium text-gray-700">Address</label>
                <textarea
                  id="address"
                  v-model="companyData.address"
                  rows="3"
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                ></textarea>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label for="city" class="block text-sm font-medium text-gray-700">City</label>
                  <input
                    id="city"
                    v-model="companyData.city"
                    type="text"
                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                  />
                </div>
                <div>
                  <label for="postcode" class="block text-sm font-medium text-gray-700">Postcode</label>
                  <input
                    id="postcode"
                    v-model="companyData.postcode"
                    type="text"
                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label for="company-phone" class="block text-sm font-medium text-gray-700">Company Phone</label>
                <input
                  id="company-phone"
                  v-model="companyData.phone"
                  type="tel"
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                />
              </div>

              <div>
                <label for="website" class="block text-sm font-medium text-gray-700">Website</label>
                <input
                  id="website"
                  v-model="companyData.website"
                  type="url"
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                  placeholder="https://example.com"
                />
              </div>

              <div v-if="companySuccess" class="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded">
                {{ companySuccess }}
              </div>

              <div v-if="companyError" class="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
                {{ companyError }}
              </div>

              <button
                type="submit"
                :disabled="companyLoading"
                class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md disabled:opacity-50"
              >
                {{ companyLoading ? 'Saving...' : 'Save Changes' }}
              </button>
            </form>
          </div>
        </div>

        <!-- Branding Tab -->
        <div v-else-if="activeTab === 'branding'" class="max-w-3xl">
          <div class="bg-white rounded-lg shadow p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">Branding Settings</h3>
            <p class="text-sm text-gray-600 mb-6">Customize the appearance of forms sent to tenants, landlords, and employers</p>

            <form @submit.prevent="handleUpdateBranding" class="space-y-6">
              <!-- Logo Upload -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Company Logo</label>
                <div class="flex items-center space-x-6">
                  <div class="flex-shrink-0">
                    <div class="w-32 h-32 border-2 border-gray-300 border-dashed rounded-lg flex items-center justify-center bg-gray-50">
                      <img v-if="logoPreview" :src="logoPreview" alt="Logo preview" class="w-full h-full object-contain rounded-lg" />
                      <div v-else class="text-center">
                        <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p class="mt-1 text-xs text-gray-500">No logo</p>
                      </div>
                    </div>
                  </div>
                  <div class="flex-1">
                    <input
                      type="file"
                      @change="handleLogoSelect"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-white hover:file:bg-primary/90"
                    />
                    <p class="mt-2 text-xs text-gray-500">PNG, JPG, or WEBP. Max 2MB.</p>
                    <button
                      v-if="logoPreview"
                      type="button"
                      @click="handleRemoveLogo"
                      class="mt-2 text-sm text-red-600 hover:text-red-800"
                    >
                      Remove logo
                    </button>
                  </div>
                </div>
              </div>

              <!-- Primary Color -->
              <div>
                <label for="primary-color" class="block text-sm font-medium text-gray-700 mb-2">Primary Color</label>
                <div class="flex items-center space-x-4">
                  <input
                    id="primary-color"
                    v-model="brandingData.primary_color"
                    type="color"
                    class="h-10 w-20 border border-gray-300 rounded cursor-pointer"
                  />
                  <input
                    v-model="brandingData.primary_color"
                    type="text"
                    class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                    placeholder="#FF8C41"
                  />
                </div>
                <p class="mt-1 text-xs text-gray-500">Used for headings and key UI elements</p>
              </div>

              <!-- Button Color -->
              <div>
                <label for="button-color" class="block text-sm font-medium text-gray-700 mb-2">Button Color</label>
                <div class="flex items-center space-x-4">
                  <input
                    id="button-color"
                    v-model="brandingData.button_color"
                    type="color"
                    class="h-10 w-20 border border-gray-300 rounded cursor-pointer"
                  />
                  <input
                    v-model="brandingData.button_color"
                    type="text"
                    class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                    placeholder="#FF8C41"
                  />
                </div>
                <p class="mt-1 text-xs text-gray-500">Used for action buttons throughout forms</p>
              </div>

              <!-- Preview -->
              <div class="border-t pt-6">
                <h4 class="text-sm font-medium text-gray-700 mb-3">Preview</h4>
                <div class="border border-gray-200 rounded-lg p-6 bg-gray-50">
                  <div v-if="logoPreview" class="mb-4">
                    <img :src="logoPreview" alt="Logo" class="h-12 object-contain" />
                  </div>
                  <h3 class="text-xl font-bold mb-4" :style="{ color: brandingData.primary_color }">
                    Reference Request Form
                  </h3>
                  <p class="text-gray-600 mb-4">This is how your forms will appear to recipients.</p>
                  <button
                    type="button"
                    class="px-4 py-2 rounded-md text-white font-medium"
                    :style="{ backgroundColor: brandingData.button_color }"
                  >
                    Submit Form
                  </button>
                </div>
              </div>

              <div v-if="brandingSuccess" class="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded">
                {{ brandingSuccess }}
              </div>

              <div v-if="brandingError" class="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
                {{ brandingError }}
              </div>

              <div class="flex gap-3">
                <button
                  type="submit"
                  :disabled="brandingLoading"
                  class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md disabled:opacity-50"
                >
                  {{ brandingLoading ? 'Saving...' : 'Save Branding Settings' }}
                </button>
                <button
                  type="button"
                  @click="handleResetBranding"
                  :disabled="brandingLoading"
                  class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-md disabled:opacity-50"
                >
                  Reset to Default
                </button>
              </div>
            </form>
          </div>
        </div>

        <!-- Team Tab -->
        <div v-else-if="activeTab === 'team'">
          <div class="mb-6 flex justify-end">
            <button
              @click="showInviteModal = true"
              class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md"
            >
              Invite User
            </button>
          </div>

          <!-- Team Members List -->
          <div class="bg-white rounded-lg shadow overflow-hidden mb-8">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                  <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr v-if="teamMembers.length === 0">
                  <td colspan="5" class="px-6 py-12 text-center text-gray-500">
                    No team members yet. Invite your first user!
                  </td>
                </tr>
                <tr v-for="member in teamMembers" :key="member.id">
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                      <div class="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-semibold">
                        {{ getInitials(member.email) }}
                      </div>
                      <div class="ml-4">
                        <div class="text-sm font-medium text-gray-900">{{ member.name || 'N/A' }}</div>
                      </div>
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ member.email }}</td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full"
                      :class="{
                        'bg-purple-100 text-purple-800': member.role === 'owner',
                        'bg-blue-100 text-blue-800': member.role === 'admin',
                        'bg-gray-100 text-gray-800': member.role === 'member'
                      }">
                      {{ member.role }}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ formatDate(member.joined) }}</td>
                  <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      v-if="member.role !== 'owner'"
                      @click="handleRemoveMember(member)"
                      class="text-red-600 hover:text-red-900"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Pending Invitations -->
          <div class="bg-white rounded-lg shadow overflow-hidden">
            <div class="px-6 py-4 border-b border-gray-200">
              <h3 class="text-lg font-semibold text-gray-900">Pending Invitations</h3>
            </div>
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invited</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expires</th>
                  <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr v-if="pendingInvitations.length === 0">
                  <td colspan="5" class="px-6 py-8 text-center text-gray-500">
                    No pending invitations
                  </td>
                </tr>
                <tr v-for="invite in pendingInvitations" :key="invite.id">
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{{ invite.email }}</td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                      {{ invite.role }}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ formatDate(invite.created) }}</td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ formatDate(invite.expires) }}</td>
                  <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      @click="handleResendInvite(invite)"
                      class="text-primary hover:text-primary/80 mr-4"
                    >
                      Resend
                    </button>
                    <button
                      @click="handleRevokeInvite(invite)"
                      class="text-red-600 hover:text-red-900"
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Audit Logs Tab -->
        <div v-else-if="activeTab === 'audit-logs'">
          <!-- Filters -->
          <div class="bg-white rounded-lg shadow p-6 mb-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">Filters</h3>
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Action Type</label>
                <select
                  v-model="auditFilters.action_type"
                  @change="fetchAuditLogs"
                  class="w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
                >
                  <option value="">All Actions</option>
                  <option value="user.invited">User Invited</option>
                  <option value="user.removed">User Removed</option>
                  <option value="user.joined">User Joined</option>
                  <option value="user.profile_updated">Profile Updated</option>
                  <option value="company.updated">Company Updated</option>
                  <option value="company.logo_uploaded">Logo Uploaded</option>
                  <option value="reference.created">Reference Created</option>
                  <option value="reference.updated">Reference Updated</option>
                  <option value="reference.deleted">Reference Deleted</option>
                </select>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Resource Type</label>
                <select
                  v-model="auditFilters.resource_type"
                  @change="fetchAuditLogs"
                  class="w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
                >
                  <option value="">All Resources</option>
                  <option value="user">User</option>
                  <option value="company">Company</option>
                  <option value="reference">Reference</option>
                  <option value="invitation">Invitation</option>
                </select>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Date From</label>
                <input
                  type="date"
                  v-model="auditFilters.start_date"
                  @change="fetchAuditLogs"
                  class="w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Date To</label>
                <input
                  type="date"
                  v-model="auditFilters.end_date"
                  @change="fetchAuditLogs"
                  class="w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
                />
              </div>
            </div>

            <div class="mt-4 flex justify-between items-center">
              <button
                @click="resetAuditFilters"
                class="text-sm text-gray-600 hover:text-gray-900"
              >
                Reset Filters
              </button>
              <button
                @click="exportAuditLogs"
                :disabled="auditLoading"
                class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md disabled:opacity-50"
              >
                Export CSV
              </button>
            </div>
          </div>

          <!-- Loading State -->
          <div v-if="auditLoading" class="text-center py-12">
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p class="mt-2 text-gray-600">Loading audit logs...</p>
          </div>

          <!-- Error State -->
          <div v-else-if="auditError" class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p class="text-red-800">{{ auditError }}</p>
          </div>

          <!-- Audit Logs Table -->
          <div v-else class="bg-white rounded-lg shadow overflow-hidden">
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date/Time</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP Address</th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                  <tr v-if="auditLogs.length === 0">
                    <td colspan="5" class="px-6 py-12 text-center text-gray-500">
                      No audit logs found
                    </td>
                  </tr>
                  <tr v-for="log in auditLogs" :key="log.id" class="hover:bg-gray-50">
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {{ formatAuditDateTime(log.created_at) }}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="flex items-center">
                        <div class="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-semibold">
                          {{ getAuditUserInitials(log.user) }}
                        </div>
                        <div class="ml-3">
                          <div class="text-sm font-medium text-gray-900">{{ log.user?.name || 'System' }}</div>
                          <div class="text-xs text-gray-500">{{ log.user?.email || '-' }}</div>
                        </div>
                      </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <span class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full"
                        :class="getAuditActionBadgeClass(log.action_type)">
                        {{ formatAuditActionType(log.action_type) }}
                      </span>
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-900">
                      {{ log.description }}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {{ log.ip_address || '-' }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Pagination -->
            <div v-if="auditPagination.totalPages > 1" class="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
              <div class="text-sm text-gray-700">
                Showing {{ (auditPagination.page - 1) * auditPagination.limit + 1 }} to
                {{ Math.min(auditPagination.page * auditPagination.limit, auditPagination.total) }} of
                {{ auditPagination.total }} results
              </div>
              <div class="flex gap-2">
                <button
                  @click="changeAuditPage(auditPagination.page - 1)"
                  :disabled="auditPagination.page === 1"
                  class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  @click="changeAuditPage(auditPagination.page + 1)"
                  :disabled="auditPagination.page >= auditPagination.totalPages"
                  class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>

    <!-- Invite Modal -->
    <div v-if="showInviteModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Invite Team Member</h3>
        <form @submit.prevent="handleInvite" class="space-y-4">
          <div>
            <label for="invite-email" class="block text-sm font-medium text-gray-700">Email</label>
            <input
              id="invite-email"
              v-model="inviteData.email"
              type="email"
              required
              class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
              placeholder="user@example.com"
            />
          </div>

          <div>
            <label for="invite-role" class="block text-sm font-medium text-gray-700">Role</label>
            <select
              id="invite-role"
              v-model="inviteData.role"
              class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div v-if="inviteError" class="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
            {{ inviteError }}
          </div>

          <div v-if="inviteSuccess" class="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded">
            {{ inviteSuccess }}
          </div>

          <div class="flex justify-end space-x-3">
            <button
              type="button"
              @click="closeInviteModal"
              class="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="inviteLoading"
              class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md disabled:opacity-50"
            >
              {{ inviteLoading ? 'Sending...' : 'Send Invite' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Reset Branding Confirmation Modal -->
    <div v-if="showResetBrandingModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div class="flex items-center mb-4">
          <div class="flex-shrink-0 w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
            <svg class="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 class="ml-3 text-lg font-semibold text-gray-900">Reset to Default Branding?</h3>
        </div>
        <p class="text-gray-600 mb-6">
          This will remove your custom logo and reset colors to PropertyGoose orange. This action cannot be undone.
        </p>
        <div class="flex justify-end space-x-3">
          <button
            type="button"
            @click="showResetBrandingModal = false"
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-md"
          >
            Cancel
          </button>
          <button
            type="button"
            @click="confirmResetBranding"
            class="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md"
          >
            Reset Branding
          </button>
        </div>
      </div>
    </div>
  </Sidebar>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Sidebar from '../components/Sidebar.vue'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const route = useRoute()
const router = useRouter()

const activeTab = computed(() => {
  const path = route.path
  if (path.includes('/settings/company')) return 'company'
  if (path.includes('/settings/branding')) return 'branding'
  if (path.includes('/settings/team')) return 'team'
  if (path.includes('/settings/audit-logs')) return 'audit-logs'
  return 'profile'
})

// Filter tabs based on user role
const tabs = computed(() => {
  const allTabs = [
    { id: 'profile', name: 'Profile' },
    { id: 'company', name: 'Company' },
    { id: 'branding', name: 'Branding' },
    { id: 'team', name: 'Team' },
    { id: 'audit-logs', name: 'Audit Logs' }
  ]

  const userRole = authStore.company?.role || ''

  // Members can only see Profile tab
  if (userRole === 'member') {
    return allTabs.filter(tab => tab.id === 'profile')
  }

  // Admins and Owners see all tabs
  return allTabs
})

// Profile data
const profileData = ref({
  email: '',
  fullName: '',
  phone: ''
})

const profileLoading = ref(false)
const profileSuccess = ref('')
const profileError = ref('')

// Password data
const passwordData = ref({
  newPassword: '',
  confirmPassword: ''
})

const passwordLoading = ref(false)
const passwordSuccess = ref('')
const passwordError = ref('')

// Company data
const companyData = ref({
  name: '',
  address: '',
  city: '',
  postcode: '',
  phone: '',
  website: ''
})

const companyLoading = ref(false)
const companySuccess = ref('')
const companyError = ref('')

// Branding data
const brandingData = ref({
  logo_url: '',
  primary_color: '#FF8C41',
  button_color: '#FF8C41'
})

const brandingLoading = ref(false)
const brandingSuccess = ref('')
const brandingError = ref('')
const logoFile = ref<File | null>(null)
const logoPreview = ref('')
const showResetBrandingModal = ref(false)

// Team data
const showInviteModal = ref(false)
const inviteData = ref({
  email: '',
  role: 'member'
})

const inviteLoading = ref(false)
const inviteError = ref('')
const inviteSuccess = ref('')

const teamMembers = ref<any[]>([])

const pendingInvitations = ref<any[]>([])

// Audit Logs data
const auditLogs = ref<any[]>([])
const auditLoading = ref(false)
const auditError = ref('')

const auditFilters = ref({
  action_type: '',
  resource_type: '',
  start_date: '',
  end_date: ''
})

const auditPagination = ref({
  page: 1,
  limit: 50,
  total: 0,
  totalPages: 0
})

// Permission checking
const hasPermission = (tabId: string) => {
  const userRole = authStore.company?.role || ''

  // Everyone can access profile
  if (tabId === 'profile') return true

  // Only admins and owners can access other tabs
  if (userRole === 'owner' || userRole === 'admin') return true

  return false
}

const fetchProfileData = async () => {
  try {
    const token = authStore.session?.access_token
    if (!token) return

    const response = await fetch(`${API_URL}/api/profile`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    if (response.ok) {
      const data = await response.json()

      // Update profile data for Profile tab
      profileData.value.email = data.email
      profileData.value.fullName = data.fullName || ''
      profileData.value.phone = data.phone || ''

      // Fetch team members for Team tab
      await fetchTeamMembers()
    }
  } catch (error) {
    console.error('Failed to fetch profile data:', error)
  }
}

const fetchTeamMembers = async () => {
  try {
    const token = authStore.session?.access_token
    if (!token) return

    const response = await fetch(`${API_URL}/api/company/members`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    if (response.ok) {
      const data = await response.json()
      teamMembers.value = data.members.map((member: any) => ({
        id: member.id,
        user_id: member.user_id,
        name: member.name || 'N/A',
        email: member.email,
        role: member.role,
        joined: new Date(member.joined)
      }))
    }
  } catch (error) {
    console.error('Failed to fetch team members:', error)
  }
}

const fetchPendingInvitations = async () => {
  try {
    const token = authStore.session?.access_token
    if (!token) return

    const response = await fetch(`${API_URL}/api/invitations`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    if (response.status === 403 || response.status === 404) {
      // User doesn't have permission (member role) - that's okay, just skip
      pendingInvitations.value = []
      return
    }

    if (response.ok) {
      const data = await response.json()
      pendingInvitations.value = data.invitations.map((invite: any) => ({
        id: invite.id,
        email: invite.email,
        role: invite.role,
        created: new Date(invite.created_at),
        expires: new Date(invite.expires_at)
      }))
    }
  } catch (error) {
    console.error('Failed to fetch invitations:', error)
  }
}

const fetchCompanyData = async () => {
  try {
    const token = authStore.session?.access_token
    if (!token) return

    const response = await fetch(`${API_URL}/api/company`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    if (response.ok) {
      const data = await response.json()
      if (data.company) {
        companyData.value.name = data.company.name || ''
        companyData.value.address = data.company.address || ''
        companyData.value.city = data.company.city || ''
        companyData.value.postcode = data.company.postcode || ''
        companyData.value.phone = data.company.phone || ''
        companyData.value.website = data.company.website || ''

        // Load branding data
        brandingData.value.logo_url = data.company.logo_url || ''
        brandingData.value.primary_color = data.company.primary_color || '#FF8C41'
        brandingData.value.button_color = data.company.button_color || '#FF8C41'
        logoPreview.value = data.company.logo_url || ''
      }
    }
  } catch (error) {
    console.error('Failed to fetch company data:', error)
  }
}

// Load audit logs when navigating to audit tab
watch(activeTab, (newTab) => {
  if (newTab === 'audit-logs' && auditLogs.value.length === 0 && hasPermission('audit-logs')) {
    fetchAuditLogs()
  }
})

onMounted(() => {
  fetchCompanyData()
  fetchProfileData()
  fetchPendingInvitations()
})

const handleUpdateProfile = async () => {
  profileLoading.value = true
  profileSuccess.value = ''
  profileError.value = ''

  try {
    const token = authStore.session?.access_token
    if (!token) {
      profileError.value = 'No auth token available'
      return
    }

    const response = await fetch(`${API_URL}/api/profile`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fullName: profileData.value.fullName,
        phone: profileData.value.phone
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to update profile')
    }

    profileSuccess.value = 'Profile updated successfully'
    // Refresh team member data to reflect name changes
    await fetchProfileData()
  } catch (error: any) {
    profileError.value = error.message || 'Failed to update profile'
  } finally {
    profileLoading.value = false
  }
}

const handleChangePassword = async () => {
  passwordLoading.value = true
  passwordSuccess.value = ''
  passwordError.value = ''

  if (passwordData.value.newPassword !== passwordData.value.confirmPassword) {
    passwordError.value = 'Passwords do not match'
    passwordLoading.value = false
    return
  }

  if (passwordData.value.newPassword.length < 6) {
    passwordError.value = 'Password must be at least 6 characters'
    passwordLoading.value = false
    return
  }

  try {
    const { error } = await authStore.updatePassword(passwordData.value.newPassword)
    if (error) {
      passwordError.value = error
    } else {
      passwordSuccess.value = 'Password updated successfully'
      passwordData.value = { newPassword: '', confirmPassword: '' }
    }
  } catch (error: any) {
    passwordError.value = error.message || 'Failed to update password'
  } finally {
    passwordLoading.value = false
  }
}

const handleUpdateCompany = async () => {
  companyLoading.value = true
  companySuccess.value = ''
  companyError.value = ''

  try {
    const token = authStore.session?.access_token
    if (!token) {
      companyError.value = 'No auth token available'
      return
    }

    const response = await fetch(`${API_URL}/api/company`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(companyData.value)
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to update company settings')
    }

    companySuccess.value = 'Company settings updated successfully'
  } catch (error: any) {
    companyError.value = error.message || 'Failed to update company settings'
  } finally {
    companyLoading.value = false
  }
}

const getInitials = (email: string) => {
  return email.charAt(0).toUpperCase()
}

const formatDate = (date: Date) => {
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

const handleInvite = async () => {
  inviteLoading.value = true
  inviteError.value = ''
  inviteSuccess.value = ''

  try {
    const token = authStore.session?.access_token
    if (!token) {
      inviteError.value = 'No auth token available'
      return
    }

    const response = await fetch(`${API_URL}/api/invitations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: inviteData.value.email,
        role: inviteData.value.role
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to send invitation')
    }

    inviteSuccess.value = `Invitation sent to ${inviteData.value.email}`

    // Refresh invitations list
    await fetchPendingInvitations()

    setTimeout(() => {
      closeInviteModal()
    }, 2000)
  } catch (error: any) {
    inviteError.value = error.message || 'Failed to send invitation'
  } finally {
    inviteLoading.value = false
  }
}

const closeInviteModal = () => {
  showInviteModal.value = false
  inviteData.value = { email: '', role: 'member' }
  inviteError.value = ''
  inviteSuccess.value = ''
}

const handleRemoveMember = async (member: any) => {
  if (!confirm(`Are you sure you want to remove ${member.email}?`)) {
    return
  }

  try {
    const token = authStore.session?.access_token
    if (!token) return

    const response = await fetch(`${API_URL}/api/company/members/${member.user_id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to remove member')
    }

    // Refresh team members list
    await fetchTeamMembers()
  } catch (error: any) {
    alert(error.message || 'Failed to remove member')
  }
}

const handleResendInvite = async (invite: any) => {
  try {
    const token = authStore.session?.access_token
    if (!token) return

    const response = await fetch(`${API_URL}/api/invitations/${invite.id}/resend`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to resend invitation')
    }

    alert('Invitation resent successfully')
    await fetchPendingInvitations()
  } catch (error: any) {
    alert(error.message || 'Failed to resend invitation')
  }
}

const handleRevokeInvite = async (invite: any) => {
  if (!confirm(`Are you sure you want to revoke the invitation to ${invite.email}?`)) {
    return
  }

  try {
    const token = authStore.session?.access_token
    if (!token) return

    const response = await fetch(`${API_URL}/api/invitations/${invite.id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to revoke invitation')
    }

    // Refresh invitations list
    await fetchPendingInvitations()
  } catch (error: any) {
    alert(error.message || 'Failed to revoke invitation')
  }
}

const handleLogoSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  if (!file) return

  // Validate file size (2MB max)
  if (file.size > 2 * 1024 * 1024) {
    brandingError.value = 'File size must be less than 2MB'
    return
  }

  // Validate file type
  const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
  if (!validTypes.includes(file.type)) {
    brandingError.value = 'File must be PNG, JPG, or WEBP'
    return
  }

  logoFile.value = file

  // Create preview
  const reader = new FileReader()
  reader.onload = (e) => {
    logoPreview.value = e.target?.result as string
  }
  reader.readAsDataURL(file)
}

const handleRemoveLogo = () => {
  logoFile.value = null
  logoPreview.value = ''
  brandingData.value.logo_url = ''
}

const handleResetBranding = () => {
  showResetBrandingModal.value = true
}

const confirmResetBranding = async () => {
  showResetBrandingModal.value = false
  brandingLoading.value = true
  brandingSuccess.value = ''
  brandingError.value = ''

  try {
    const token = authStore.session?.access_token
    if (!token) {
      brandingError.value = 'No auth token available'
      return
    }

    // Reset to default values
    const response = await fetch(`${API_URL}/api/company`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        logo_url: null,
        primary_color: '#f97316',
        button_color: '#f97316'
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to reset branding')
    }

    // Update local state
    brandingData.value.logo_url = ''
    brandingData.value.primary_color = '#f97316'
    brandingData.value.button_color = '#f97316'
    logoFile.value = null
    logoPreview.value = ''

    brandingSuccess.value = 'Branding reset to default successfully'
  } catch (error: any) {
    brandingError.value = error.message || 'Failed to reset branding'
  } finally {
    brandingLoading.value = false
  }
}

const handleUpdateBranding = async () => {
  brandingLoading.value = true
  brandingSuccess.value = ''
  brandingError.value = ''

  try {
    const token = authStore.session?.access_token
    if (!token) {
      brandingError.value = 'No auth token available'
      return
    }

    let logoUrl = brandingData.value.logo_url

    // Upload logo if a new file was selected
    if (logoFile.value) {
      const formData = new FormData()
      formData.append('logo', logoFile.value)

      const uploadResponse = await fetch(`${API_URL}/api/company/logo`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json()
        throw new Error(errorData.error || 'Failed to upload logo')
      }

      const uploadData = await uploadResponse.json()
      logoUrl = uploadData.logo_url
    }

    // Update branding settings
    const response = await fetch(`${API_URL}/api/company`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        logo_url: logoUrl,
        primary_color: brandingData.value.primary_color,
        button_color: brandingData.value.button_color
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to update branding settings')
    }

    brandingSuccess.value = 'Branding settings updated successfully'
    logoFile.value = null
  } catch (error: any) {
    brandingError.value = error.message || 'Failed to update branding settings'
  } finally {
    brandingLoading.value = false
  }
}

// Audit Logs functions
const fetchAuditLogs = async () => {
  auditLoading.value = true
  auditError.value = ''

  try {
    const token = authStore.session?.access_token
    if (!token) {
      throw new Error('Not authenticated')
    }

    const params: any = {
      page: auditPagination.value.page,
      limit: auditPagination.value.limit
    }

    if (auditFilters.value.action_type) params.action_type = auditFilters.value.action_type
    if (auditFilters.value.resource_type) params.resource_type = auditFilters.value.resource_type
    if (auditFilters.value.start_date) params.start_date = new Date(auditFilters.value.start_date).toISOString()
    if (auditFilters.value.end_date) params.end_date = new Date(auditFilters.value.end_date).toISOString()

    const queryString = new URLSearchParams(params).toString()
    const response = await fetch(`${API_URL}/api/audit-logs?${queryString}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to load audit logs')
    }

    const data = await response.json()
    auditLogs.value = data.logs
    auditPagination.value = data.pagination
  } catch (err: any) {
    auditError.value = err.message || 'Failed to load audit logs'
  } finally {
    auditLoading.value = false
  }
}

const changeAuditPage = (page: number) => {
  auditPagination.value.page = page
  fetchAuditLogs()
}

const resetAuditFilters = () => {
  auditFilters.value.action_type = ''
  auditFilters.value.resource_type = ''
  auditFilters.value.start_date = ''
  auditFilters.value.end_date = ''
  auditPagination.value.page = 1
  fetchAuditLogs()
}

const exportAuditLogs = async () => {
  try {
    const token = authStore.session?.access_token
    if (!token) {
      throw new Error('Not authenticated')
    }

    const params: any = {}
    if (auditFilters.value.start_date) params.start_date = new Date(auditFilters.value.start_date).toISOString()
    if (auditFilters.value.end_date) params.end_date = new Date(auditFilters.value.end_date).toISOString()

    const queryString = new URLSearchParams(params).toString()
    const response = await fetch(`${API_URL}/api/audit-logs/export?${queryString}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (!response.ok) {
      throw new Error('Failed to export audit logs')
    }

    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `audit-logs-${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)

    alert('Audit logs exported successfully')
  } catch (err: any) {
    alert('Failed to export audit logs')
  }
}

const formatAuditDateTime = (dateString: string) => {
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

const formatAuditActionType = (actionType: string) => {
  return actionType
    .split('.')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

const getAuditUserInitials = (user: any) => {
  if (!user) return 'S'
  if (user.name) {
    const names = user.name.split(' ')
    return names.map((n: string) => n.charAt(0).toUpperCase()).join('')
  }
  return user.email.charAt(0).toUpperCase()
}

const getAuditActionBadgeClass = (actionType: string) => {
  if (actionType.includes('deleted') || actionType.includes('removed')) {
    return 'bg-red-100 text-red-800'
  }
  if (actionType.includes('created') || actionType.includes('invited') || actionType.includes('joined')) {
    return 'bg-green-100 text-green-800'
  }
  if (actionType.includes('updated')) {
    return 'bg-blue-100 text-blue-800'
  }
  return 'bg-gray-100 text-gray-800'
}
</script>
