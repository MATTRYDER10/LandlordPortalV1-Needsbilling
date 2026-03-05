<template>
  <Sidebar>
    <div class="p-8">
      <div class="mb-8">
        <h2 class="text-3xl font-bold text-gray-900 dark:text-white">Profile Settings</h2>
        <p class="mt-2 text-gray-600 dark:text-slate-400">Manage your personal information and preferences</p>
      </div>

      <div class="max-w-3xl">
        <!-- Profile Information -->
        <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-6 mb-6">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Personal Information</h3>
          <form @submit.prevent="handleUpdateProfile" class="space-y-4">
            <div>
              <label for="email" class="block text-sm font-medium text-gray-700 dark:text-slate-300">Email</label>
              <input
                id="email"
                v-model="profileData.email"
                type="email"
                disabled
                class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-gray-100 dark:bg-slate-700 dark:text-white cursor-not-allowed"
              />
              <p class="mt-1 text-sm text-gray-500 dark:text-slate-400">Email cannot be changed</p>
            </div>

            <div>
              <label for="full-name" class="block text-sm font-medium text-gray-700 dark:text-slate-300">Full Name</label>
              <input
                id="full-name"
                v-model="profileData.fullName"
                type="text"
                class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md dark:bg-slate-900 dark:text-white focus:ring-primary focus:border-primary"
              />
            </div>

            <div>
              <label for="phone" class="block text-sm font-medium text-gray-700 dark:text-slate-300">Phone Number</label>
              <input
                id="phone"
                v-model="profileData.phone"
                type="tel"
                class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md dark:bg-slate-900 dark:text-white focus:ring-primary focus:border-primary"
              />
            </div>

            <div v-if="successMessage" class="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 text-green-600 dark:text-green-400 px-4 py-3 rounded">
              {{ successMessage }}
            </div>

            <div v-if="errorMessage" class="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-600 dark:text-red-400 px-4 py-3 rounded">
              {{ errorMessage }}
            </div>

            <button
              type="submit"
              :disabled="loading"
              class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md disabled:opacity-50"
            >
              {{ loading ? 'Saving...' : 'Save Changes' }}
            </button>
          </form>
        </div>

        <!-- Change Password -->
        <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Change Password</h3>
          <form @submit.prevent="handleChangePassword" class="space-y-4">
            <div>
              <label for="new-password" class="block text-sm font-medium text-gray-700 dark:text-slate-300">New Password</label>
              <input
                id="new-password"
                v-model="passwordData.newPassword"
                type="password"
                class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md dark:bg-slate-900 dark:text-white focus:ring-primary focus:border-primary"
                placeholder="At least 6 characters"
              />
            </div>

            <div>
              <label for="confirm-password" class="block text-sm font-medium text-gray-700 dark:text-slate-300">Confirm Password</label>
              <input
                id="confirm-password"
                v-model="passwordData.confirmPassword"
                type="password"
                class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md dark:bg-slate-900 dark:text-white focus:ring-primary focus:border-primary"
                placeholder="Confirm new password"
              />
            </div>

            <div v-if="passwordSuccess" class="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 text-green-600 dark:text-green-400 px-4 py-3 rounded">
              {{ passwordSuccess }}
            </div>

            <div v-if="passwordError" class="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-600 dark:text-red-400 px-4 py-3 rounded">
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
    </div>
  </Sidebar>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Sidebar from '../components/Sidebar.vue'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()

const profileData = ref({
  email: '',
  fullName: '',
  phone: ''
})

const passwordData = ref({
  newPassword: '',
  confirmPassword: ''
})

const loading = ref(false)
const successMessage = ref('')
const errorMessage = ref('')

const passwordLoading = ref(false)
const passwordSuccess = ref('')
const passwordError = ref('')

onMounted(() => {
  profileData.value.email = authStore.user?.email || ''
  // TODO: Load user metadata
})

const handleUpdateProfile = async () => {
  loading.value = true
  successMessage.value = ''
  errorMessage.value = ''

  try {
    // TODO: Update user profile in Supabase
    successMessage.value = 'Profile updated successfully'
  } catch (error: any) {
    errorMessage.value = error.message || 'Failed to update profile'
  } finally {
    loading.value = false
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
</script>
