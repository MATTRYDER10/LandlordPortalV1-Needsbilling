<template>
  <Sidebar>
    <div class="p-8">
      <div class="mb-8 flex justify-between items-center">
        <div>
          <h2 class="text-3xl font-bold text-gray-900">Team Members</h2>
          <p class="mt-2 text-gray-600">Manage your company's users and send invitations</p>
        </div>
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

    <!-- Invite Modal -->
    <div v-if="showInviteModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Invite Team Member</h3>
        <form @submit.prevent="handleInvite" class="space-y-4">
          <div>
            <label for="invite-email" class="block text-sm font-medium text-gray-700 dark:text-slate-200">Email</label>
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
            <label for="invite-role" class="block text-sm font-medium text-gray-700 dark:text-slate-200">Role</label>
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
import { ref } from 'vue'
import Sidebar from '../components/Sidebar.vue'
import { formatDate as formatUkDate } from '../utils/date'
import { isValidEmail } from '../utils/validation'

const showInviteModal = ref(false)
const inviteData = ref({
  email: '',
  role: 'member'
})

const inviteLoading = ref(false)
const inviteError = ref('')
const inviteSuccess = ref('')

// Mock data - will be replaced with real data from Supabase
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

const getInitials = (email: string) => {
  return email.charAt(0).toUpperCase()
}

const formatDate = (date?: string | number | Date | null, fallback = 'N/A') =>
  formatUkDate(
    date,
    {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    },
    fallback
  )

const handleInvite = async () => {
  inviteLoading.value = true
  inviteError.value = ''
  inviteSuccess.value = ''

  // Validate email
  if (!isValidEmail(inviteData.value.email)) {
    inviteError.value = 'Please enter a valid email address'
    inviteLoading.value = false
    return
  }

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
