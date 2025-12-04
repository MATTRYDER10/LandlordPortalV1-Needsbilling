<template>
  <div class="min-h-screen bg-background">
    <!-- Header -->
    <AdminHeader />

    <!-- Page Header -->
    <div class="bg-white border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-2xl font-bold text-gray-900">Staff Management</h2>
            <p class="mt-1 text-sm text-gray-600">Manage PropertyGoose staff accounts</p>
          </div>
          <button
            @click="showCreateModal = true"
            class="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
          >
            Create Staff Account
          </button>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Loading State -->
      <div v-if="loading" class="flex justify-center py-12">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>

      <!-- Staff List -->
      <div v-else class="bg-white rounded-lg shadow">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-if="staffList.length === 0">
                <td colspan="6" class="px-6 py-4 text-center text-gray-500">No staff accounts found</td>
              </tr>
              <tr v-else v-for="staff in staffList" :key="staff.id" class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {{ staff.full_name }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {{ staff.email }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span
                    :class="staff.is_admin ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'"
                    class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full"
                  >
                    {{ staff.is_admin ? 'Admin' : 'Staff' }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span
                    :class="staff.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'"
                    class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full"
                  >
                    {{ staff.is_active ? 'Active' : 'Inactive' }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {{ formatDate(staff.created_at) }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div class="flex gap-2">
                    <button
                      @click="toggleStaffStatus(staff)"
                      :class="staff.is_active ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'"
                      class="transition-colors"
                    >
                      {{ staff.is_active ? 'Deactivate' : 'Activate' }}
                    </button>
                    <span class="text-gray-300">|</span>
                    <button
                      @click="toggleAdminStatus(staff)"
                      class="text-indigo-600 hover:text-indigo-900 transition-colors"
                    >
                      {{ staff.is_admin ? 'Remove Admin' : 'Make Admin' }}
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Create Staff Modal -->
    <div v-if="showCreateModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div class="mt-3">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Create Staff Account</h3>
          <form @submit.prevent="createStaffAccount">
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  v-model="newStaff.fullName"
                  type="text"
                  required
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  v-model="newStaff.email"
                  type="email"
                  required
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="john@propertygoose.com"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  v-model="newStaff.password"
                  type="password"
                  required
                  minlength="8"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="Minimum 8 characters"
                />
              </div>
              <div class="flex items-center">
                <input
                  v-model="newStaff.isAdmin"
                  type="checkbox"
                  id="isAdmin"
                  class="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                />
                <label for="isAdmin" class="ml-2 block text-sm text-gray-700">
                  Grant admin privileges
                </label>
              </div>
            </div>
            <div class="flex gap-3 mt-6">
              <button
                type="submit"
                :disabled="creatingStaff"
                class="flex-1 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {{ creatingStaff ? 'Creating...' : 'Create Account' }}
              </button>
              <button
                type="button"
                @click="closeCreateModal"
                :disabled="creatingStaff"
                class="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { useAuthStore } from '../stores/auth'
import AdminHeader from '../components/AdminHeader.vue'

const authStore = useAuthStore()
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

interface StaffUser {
  id: string
  email: string
  full_name: string
  is_active: boolean
  is_admin: boolean
  created_at: string
  updated_at: string
}

const loading = ref(true)
const staffList = ref<StaffUser[]>([])
const showCreateModal = ref(false)
const creatingStaff = ref(false)
const newStaff = ref({
  fullName: '',
  email: '',
  password: '',
  isAdmin: false
})

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(date)
}

const fetchStaffList = async () => {
  loading.value = true
  try {
    const token = authStore.session?.access_token
    const response = await axios.get(`${API_URL}/api/admin/staff`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
    staffList.value = response.data.staff
  } catch (error) {
    console.error('Error fetching staff list:', error)
    alert('Failed to load staff list')
  } finally {
    loading.value = false
  }
}

const createStaffAccount = async () => {
  creatingStaff.value = true
  try {
    const token = authStore.session?.access_token
    await axios.post(
      `${API_URL}/api/admin/staff`,
      {
        email: newStaff.value.email,
        fullName: newStaff.value.fullName,
        password: newStaff.value.password,
        isAdmin: newStaff.value.isAdmin
      },
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    )
    alert('Staff account created successfully!')
    closeCreateModal()
    fetchStaffList()
  } catch (error: any) {
    console.error('Error creating staff account:', error)
    alert(error.response?.data?.error || 'Failed to create staff account')
  } finally {
    creatingStaff.value = false
  }
}

const toggleStaffStatus = async (staff: StaffUser) => {
  const action = staff.is_active ? 'deactivate' : 'activate'
  if (!confirm(`Are you sure you want to ${action} ${staff.full_name}?`)) {
    return
  }

  try {
    const token = authStore.session?.access_token
    await axios.patch(
      `${API_URL}/api/admin/staff/${staff.id}`,
      {
        isActive: !staff.is_active
      },
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    )
    alert(`Staff account ${action}d successfully!`)
    fetchStaffList()
  } catch (error) {
    console.error('Error updating staff status:', error)
    alert('Failed to update staff status')
  }
}

const toggleAdminStatus = async (staff: StaffUser) => {
  const action = staff.is_admin ? 'remove admin privileges from' : 'grant admin privileges to'
  if (!confirm(`Are you sure you want to ${action} ${staff.full_name}?`)) {
    return
  }

  try {
    const token = authStore.session?.access_token
    await axios.patch(
      `${API_URL}/api/admin/staff/${staff.id}`,
      {
        isAdmin: !staff.is_admin
      },
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    )
    alert('Admin status updated successfully!')
    fetchStaffList()
  } catch (error) {
    console.error('Error updating admin status:', error)
    alert('Failed to update admin status')
  }
}

const closeCreateModal = () => {
  showCreateModal.value = false
  newStaff.value = {
    fullName: '',
    email: '',
    password: '',
    isAdmin: false
  }
}

onMounted(() => {
  fetchStaffList()
})
</script>
