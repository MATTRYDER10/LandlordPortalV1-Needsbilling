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
            <button
              v-for="tab in tabs"
              :key="tab.id"
              @click="activeTab = tab.id"
              class="w-full text-left px-4 py-3 rounded-md font-medium text-sm transition-colors"
              :class="activeTab === tab.id
                ? 'bg-primary text-white'
                : 'text-gray-700 hover:bg-gray-100'"
            >
              {{ tab.name }}
            </button>
          </div>
        </nav>

        <!-- Tab Content -->
        <div class="flex-1">
        <!-- Profile Tab -->
        <div v-show="activeTab === 'profile'" class="max-w-3xl">
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
        <div v-show="activeTab === 'company'" class="max-w-3xl">
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

        <!-- Team Tab -->
        <div v-show="activeTab === 'team'">
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
  </Sidebar>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Sidebar from '../components/Sidebar.vue'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const activeTab = ref('profile')

const tabs = [
  { id: 'profile', name: 'Profile' },
  { id: 'company', name: 'Company' },
  { id: 'team', name: 'Team' }
]

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

// Team data
const showInviteModal = ref(false)
const inviteData = ref({
  email: '',
  role: 'member'
})

const inviteLoading = ref(false)
const inviteError = ref('')
const inviteSuccess = ref('')

const teamMembers = ref([
  {
    id: '1',
    name: 'John Doe',
    email: 'john@example.com',
    role: 'owner',
    joined: new Date('2024-01-01')
  }
])

const pendingInvitations = ref<any[]>([])

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
      }
    }
  } catch (error) {
    console.error('Failed to fetch company data:', error)
  }
}

onMounted(() => {
  profileData.value.email = authStore.user?.email || ''
  fetchCompanyData()
})

const handleUpdateProfile = async () => {
  profileLoading.value = true
  profileSuccess.value = ''
  profileError.value = ''

  try {
    // TODO: Update user profile in Supabase
    profileSuccess.value = 'Profile updated successfully'
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
    // TODO: Send invitation via backend API
    inviteSuccess.value = `Invitation sent to ${inviteData.value.email}`
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
  if (confirm(`Are you sure you want to remove ${member.email}?`)) {
    // TODO: Remove member via API
  }
}

const handleResendInvite = async (_invite: any) => {
  // TODO: Resend invitation
}

const handleRevokeInvite = async (_invite: any) => {
  if (confirm(`Are you sure you want to revoke the invitation to ${_invite.email}?`)) {
    // TODO: Revoke invitation via API
  }
}
</script>
