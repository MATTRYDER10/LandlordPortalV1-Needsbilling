<template>
  <Sidebar>
    <div class="p-8">
      <div class="mb-8">
        <h2 class="text-3xl font-bold text-gray-900">Company Settings</h2>
        <p class="mt-2 text-gray-600">Manage your company information</p>
      </div>

      <div class="max-w-3xl">
        <div class="bg-white rounded-lg shadow p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Company Information</h3>
          <form @submit.prevent="handleUpdate" class="space-y-4">
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
              <label for="phone" class="block text-sm font-medium text-gray-700">Company Phone</label>
              <input
                id="phone"
                v-model="companyData.phone"
                type="tel"
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
              />
            </div>

            <div>
              <label for="email" class="block text-sm font-medium text-gray-700">Company Email</label>
              <input
                id="email"
                v-model="companyData.email"
                type="email"
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                placeholder="contact@company.com"
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

            <div v-if="successMessage" class="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded">
              {{ successMessage }}
            </div>

            <div v-if="errorMessage" class="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
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
      </div>
    </div>
  </Sidebar>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Sidebar from '../components/Sidebar.vue'
import { useAuthStore } from '../stores/auth'
import { isValidEmail } from '../utils/validation'

const authStore = useAuthStore()

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const companyData = ref({
  name: '',
  address: '',
  city: '',
  postcode: '',
  phone: '',
  email: '',
  website: ''
})

const loading = ref(false)
const successMessage = ref('')
const errorMessage = ref('')

onMounted(async () => {
  try {
    const token = authStore.session?.access_token
    if (!token) return

    const response = await fetch(`${API_URL}/api/company`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (response.ok) {
      const data = await response.json()
      if (data.company) {
        companyData.value = {
          name: data.company.name || '',
          address: data.company.address || '',
          city: data.company.city || '',
          postcode: data.company.postcode || '',
          phone: data.company.phone || '',
          email: data.company.email || '',
          website: data.company.website || ''
        }
      }
    }
  } catch (error) {
    console.error('Failed to load company data:', error)
  }
})

const handleUpdate = async () => {
  loading.value = true
  successMessage.value = ''
  errorMessage.value = ''

  // Validate email if provided
  if (companyData.value.email && !isValidEmail(companyData.value.email)) {
    errorMessage.value = 'Please enter a valid email address'
    loading.value = false
    return
  }

  try {
    const token = authStore.session?.access_token
    if (!token) {
      errorMessage.value = 'Not authenticated'
      loading.value = false
      return
    }

    const response = await fetch(`${API_URL}/api/company`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(companyData.value)
    })

    if (!response.ok) {
      throw new Error('Failed to update company settings')
    }

    successMessage.value = 'Company settings updated successfully'
  } catch (error: any) {
    errorMessage.value = error.message || 'Failed to update company settings'
  } finally {
    loading.value = false
  }
}
</script>
