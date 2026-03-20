<template>
  <div class="min-h-screen bg-background">
    <!-- Header -->
    <AdminHeader />

    <!-- Page Header -->
    <div class="bg-white border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div class="flex items-center gap-3">
          <router-link
            to="/admin/customers"
            class="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ArrowLeft class="w-5 h-5" />
          </router-link>
          <div>
            <h2 class="text-2xl font-bold text-gray-900">Create New Company</h2>
            <p class="mt-1 text-sm text-gray-600">Set up a new agent/company account and send an invitation to the owner</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Success State -->
      <div v-if="success" class="bg-white rounded-lg shadow p-8">
        <div class="text-center mb-6">
          <div class="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle class="w-8 h-8 text-green-600" />
          </div>
          <h3 class="text-xl font-bold text-gray-900">Company Created Successfully</h3>
          <p class="mt-2 text-gray-600">
            An invitation email has been sent to <span class="font-medium">{{ form.ownerEmail }}</span>
          </p>
        </div>

        <div class="bg-gray-50 rounded-md p-4 mb-6">
          <label class="block text-sm font-medium text-gray-700 mb-1">Invitation Link</label>
          <div class="flex items-center gap-2">
            <input
              type="text"
              :value="inviteLink"
              readonly
              class="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-white text-sm text-gray-800 font-mono"
            />
            <button
              @click="copyLink"
              class="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary/90 transition-colors flex items-center gap-1"
            >
              <Copy class="w-4 h-4" />
              {{ copied ? 'Copied!' : 'Copy' }}
            </button>
          </div>
        </div>

        <div class="flex gap-3">
          <button
            @click="resetForm"
            class="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Create Another
          </button>
          <router-link
            to="/admin/customers"
            class="flex-1 px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary/90 transition-colors text-center"
          >
            Back to Customers
          </router-link>
        </div>
      </div>

      <!-- Form -->
      <div v-else class="bg-white rounded-lg shadow p-6">
        <form @submit.prevent="handleSubmit" class="space-y-6">
          <!-- Company Name -->
          <div>
            <label for="companyName" class="block text-sm font-medium text-gray-700">
              Company Name <span class="text-red-500">*</span>
            </label>
            <input
              id="companyName"
              v-model="form.companyName"
              type="text"
              required
              placeholder="e.g. Smith & Co Lettings"
              class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>

          <!-- Owner Details -->
          <div class="border-t border-gray-200 pt-6">
            <h4 class="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User class="w-4 h-4 text-gray-500" />
              Owner Details
            </h4>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label for="ownerFirstName" class="block text-sm font-medium text-gray-700">
                  First Name <span class="text-red-500">*</span>
                </label>
                <input
                  id="ownerFirstName"
                  v-model="form.ownerFirstName"
                  type="text"
                  required
                  placeholder="John"
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>

              <div>
                <label for="ownerLastName" class="block text-sm font-medium text-gray-700">
                  Last Name <span class="text-red-500">*</span>
                </label>
                <input
                  id="ownerLastName"
                  v-model="form.ownerLastName"
                  type="text"
                  required
                  placeholder="Smith"
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>
            </div>

            <div class="mt-4">
              <label for="ownerEmail" class="block text-sm font-medium text-gray-700">
                Email <span class="text-red-500">*</span>
              </label>
              <input
                id="ownerEmail"
                v-model="form.ownerEmail"
                type="email"
                required
                placeholder="john@smithlettings.co.uk"
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>

            <div class="mt-4">
              <label for="ownerPhone" class="block text-sm font-medium text-gray-700">
                Phone <span class="text-gray-400 text-xs">(optional)</span>
              </label>
              <input
                id="ownerPhone"
                v-model="form.phone"
                type="tel"
                placeholder="07700 900000"
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
          </div>

          <!-- Package Type -->
          <div class="border-t border-gray-200 pt-6">
            <h4 class="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Package class="w-4 h-4 text-gray-500" />
              Package / Plan
            </h4>

            <div class="grid grid-cols-3 gap-3">
              <button
                v-for="pkg in packages"
                :key="pkg.value"
                type="button"
                @click="form.packageType = pkg.value"
                class="relative px-4 py-3 border rounded-lg text-center transition-all"
                :class="form.packageType === pkg.value
                  ? 'border-primary bg-primary/5 ring-2 ring-primary'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'"
              >
                <p class="text-sm font-semibold" :class="form.packageType === pkg.value ? 'text-primary' : 'text-gray-900'">
                  {{ pkg.label }}
                </p>
              </button>
            </div>
          </div>

          <!-- Error Message -->
          <div v-if="errorMessage" class="p-3 bg-red-50 border border-red-200 rounded-md">
            <p class="text-sm text-red-600">{{ errorMessage }}</p>
          </div>

          <!-- Submit Button -->
          <div class="border-t border-gray-200 pt-6">
            <button
              type="submit"
              :disabled="submitting || !isFormValid"
              class="w-full flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-primary rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send class="w-4 h-4" />
              {{ submitting ? 'Creating...' : 'Create Company & Send Invite' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import axios from 'axios'
import { useAuthStore } from '../stores/auth'
import AdminHeader from '../components/AdminHeader.vue'
import { ArrowLeft, CheckCircle, Copy, User, Package, Send } from 'lucide-vue-next'

const API_URL = import.meta.env.VITE_API_URL ?? ''
const authStore = useAuthStore()

const packages = [
  { label: 'Basic', value: 'basic' },
  { label: 'Professional', value: 'professional' },
  { label: 'Enterprise', value: 'enterprise' }
]

const form = ref({
  companyName: '',
  ownerFirstName: '',
  ownerLastName: '',
  ownerEmail: '',
  phone: '',
  packageType: 'professional'
})

const submitting = ref(false)
const success = ref(false)
const inviteLink = ref('')
const errorMessage = ref('')
const copied = ref(false)

const isFormValid = computed(() => {
  return form.value.companyName.trim() !== '' &&
    form.value.ownerFirstName.trim() !== '' &&
    form.value.ownerLastName.trim() !== '' &&
    form.value.ownerEmail.trim() !== ''
})

const handleSubmit = async () => {
  if (!isFormValid.value) return

  submitting.value = true
  errorMessage.value = ''

  try {
    const token = authStore.session?.access_token
    const response = await axios.post(
      `${API_URL}/api/admin/create-company`,
      {
        companyName: form.value.companyName.trim(),
        ownerEmail: form.value.ownerEmail.trim(),
        ownerFirstName: form.value.ownerFirstName.trim(),
        ownerLastName: form.value.ownerLastName.trim(),
        phone: form.value.phone.trim() || undefined,
        packageType: form.value.packageType
      },
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    )

    inviteLink.value = response.data.inviteLink
    success.value = true
  } catch (error: any) {
    console.error('Error creating company:', error)
    errorMessage.value = error.response?.data?.error || 'Failed to create company. Please try again.'
  } finally {
    submitting.value = false
  }
}

const copyLink = async () => {
  try {
    await navigator.clipboard.writeText(inviteLink.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch {
    // Fallback
    const input = document.createElement('input')
    input.value = inviteLink.value
    document.body.appendChild(input)
    input.select()
    document.execCommand('copy')
    document.body.removeChild(input)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  }
}

const resetForm = () => {
  form.value = {
    companyName: '',
    ownerFirstName: '',
    ownerLastName: '',
    ownerEmail: '',
    phone: '',
    packageType: 'professional'
  }
  success.value = false
  inviteLink.value = ''
  errorMessage.value = ''
}
</script>
