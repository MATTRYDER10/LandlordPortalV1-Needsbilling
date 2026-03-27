<template>
  <div class="bg-white dark:bg-slate-900 rounded-lg shadow dark:shadow-slate-900/50 p-6">
    <div class="flex items-center gap-3 mb-6">
      <div class="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
        <Star class="w-5 h-5 text-amber-600 dark:text-amber-400" />
      </div>
      <div>
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Review Link Settings</h3>
        <p class="text-sm text-gray-500 dark:text-slate-400">Configure your review link for this branch</p>
      </div>
    </div>

    <form @submit.prevent="handleSave" class="space-y-6">
      <!-- Platform Selection -->
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Review Platform</label>
        <div class="grid grid-cols-3 gap-3">
          <button
            v-for="platform in platforms"
            :key="platform.value"
            type="button"
            @click="formData.platform = platform.value"
            class="flex flex-col items-center p-4 border-2 rounded-lg transition-all"
            :class="formData.platform === platform.value
              ? 'border-primary bg-primary/5 dark:bg-primary/10'
              : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600'"
          >
            <!-- Google G Logo -->
            <svg v-if="platform.value === 'google'" class="w-8 h-8 mb-2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <component v-else :is="platform.icon" class="w-8 h-8 mb-2" :class="platform.iconClass" />
            <span class="text-sm font-medium text-gray-900 dark:text-white">{{ platform.label }}</span>
          </button>
        </div>
      </div>

      <!-- Review Link URL -->
      <div>
        <label for="review-link" class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
          Review Link URL
        </label>
        <input
          id="review-link"
          v-model="formData.reviewLink"
          type="url"
          placeholder="https://g.page/r/..."
          class="w-full px-4 py-3 border border-gray-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
        />
        <p class="mt-2 text-sm text-gray-500 dark:text-slate-400">
          <template v-if="formData.platform === 'google'">
            Find your Google review link in your Google Business Profile
          </template>
          <template v-else-if="formData.platform === 'trustpilot'">
            Find your Trustpilot link in your business account settings
          </template>
          <template v-else>
            Enter the URL where tenants should leave reviews
          </template>
        </p>
      </div>

      <!-- Status Messages -->
      <div v-if="success" class="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 px-4 py-3 rounded-lg flex items-center gap-2">
        <CheckCircle class="w-5 h-5" />
        {{ success }}
      </div>

      <div v-if="error" class="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg flex items-center gap-2">
        <AlertCircle class="w-5 h-5" />
        {{ error }}
      </div>

      <!-- Actions -->
      <div class="flex items-center gap-3">
        <button
          type="submit"
          :disabled="saving || !formData.reviewLink"
          class="px-6 py-2.5 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <Loader2 v-if="saving" class="w-4 h-4 animate-spin" />
          {{ saving ? 'Saving...' : 'Save Settings' }}
        </button>
        <button
          v-if="formData.reviewLink"
          type="button"
          @click="handleRemove"
          :disabled="saving"
          class="px-4 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg disabled:opacity-50"
        >
          Remove Link
        </button>
      </div>
    </form>

    <!-- Preview -->
    <div v-if="formData.reviewLink" class="mt-8 pt-6 border-t border-gray-200 dark:border-slate-700">
      <h4 class="text-sm font-medium text-gray-700 dark:text-slate-300 mb-3">Preview</h4>
      <div class="bg-gray-50 dark:bg-slate-800 rounded-lg p-4">
        <p class="text-sm text-gray-600 dark:text-slate-400 mb-2">
          When you send a review request, tenants will receive an email asking them to leave a review on
          <span class="font-medium text-gray-900 dark:text-white">{{ platformLabel }}</span>
        </p>
        <a
          :href="formData.reviewLink"
          target="_blank"
          rel="noopener noreferrer"
          class="text-sm text-primary hover:text-primary/80 flex items-center gap-1"
        >
          {{ formData.reviewLink }}
          <ExternalLink class="w-3 h-3" />
        </a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { Star, CheckCircle, AlertCircle, Loader2, ExternalLink } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { authFetch } from '@/lib/authFetch'

const API_URL = import.meta.env.VITE_API_URL ?? ''

const authStore = useAuthStore()

const formData = ref({
  reviewLink: '',
  platform: 'google' as 'google' | 'trustpilot' | 'other'
})

const saving = ref(false)
const loading = ref(false)
const success = ref('')
const error = ref('')

// Platform options with icons
const platforms: Array<{
  value: 'google' | 'trustpilot' | 'other'
  label: string
  icon: any
  iconClass: string
}> = [
  {
    value: 'google',
    label: 'Google',
    icon: null, // Google uses inline SVG in template
    iconClass: ''
  },
  {
    value: 'trustpilot',
    label: 'Trustpilot',
    icon: Star,
    iconClass: 'text-green-500 fill-green-500'
  },
  {
    value: 'other',
    label: 'Other',
    icon: Star,
    iconClass: 'text-gray-400'
  }
]

const platformLabel = computed(() => {
  const platform = platforms.find(p => p.value === formData.value.platform)
  return platform?.label || 'your review platform'
})

const fetchSettings = async () => {
  loading.value = true
  error.value = ''

  try {
    const token = authStore.session?.access_token
    if (!token) return

    const response = await authFetch(`${API_URL}/api/review-links/settings`, {
      token
    })

    if (response.ok) {
      const data = await response.json()
      formData.value.reviewLink = data.review_link || ''
      formData.value.platform = data.review_platform || 'google'
    }
  } catch (err: any) {
    console.error('Failed to fetch review link settings:', err)
  } finally {
    loading.value = false
  }
}

const handleSave = async () => {
  saving.value = true
  success.value = ''
  error.value = ''

  try {
    const token = authStore.session?.access_token
    if (!token) {
      error.value = 'Not authenticated'
      return
    }

    const response = await authFetch(`${API_URL}/api/review-links/settings`, {
      method: 'POST',
      token,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        review_link: formData.value.reviewLink,
        review_platform: formData.value.platform
      })
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to save settings')
    }

    success.value = 'Review link settings saved successfully'
    setTimeout(() => { success.value = '' }, 3000)
  } catch (err: any) {
    error.value = err.message || 'Failed to save settings'
  } finally {
    saving.value = false
  }
}

const handleRemove = async () => {
  if (!confirm('Are you sure you want to remove the review link?')) return

  formData.value.reviewLink = ''
  await handleSave()
}

onMounted(fetchSettings)

// Refresh when branch changes
watch(() => authStore.activeBranchId, fetchSettings)
</script>
