<template>
  <div class="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 flex items-center justify-center px-4 py-12">
    <div class="max-w-4xl w-full">
      <!-- Header -->
      <div class="text-center mb-10">
        <img src="/PropertyGooseLogo.png" alt="PropertyGoose" class="h-20 mx-auto mb-6" />
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Please select Branch
        </h1>
        <p class="text-gray-600 dark:text-slate-400">
          Select the branch you'd like to work with
        </p>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="flex justify-center py-12">
        <div class="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-6 py-4 rounded-lg text-center mb-6">
        {{ error }}
      </div>

      <!-- Branch Cards Grid -->
      <div v-else-if="branches.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <button
          v-for="branch in branches"
          :key="branch.id"
          @click="selectBranch(branch)"
          :disabled="selecting !== null"
          class="group relative bg-white dark:bg-slate-800 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 p-6 text-left border-2 border-transparent hover:border-primary hover:-translate-y-1 disabled:opacity-75 disabled:cursor-wait"
          :class="{ 'border-primary ring-2 ring-primary/20': selecting === branch.id }"
        >
          <!-- Branch Logo or Initial -->
          <div class="flex items-start justify-between mb-4">
            <div class="w-16 h-16 rounded-xl bg-gradient-to-br from-primary/10 to-orange-100 dark:from-primary/20 dark:to-orange-900/20 flex items-center justify-center overflow-hidden">
              <img
                v-if="branch.logoUrl"
                :src="branch.logoUrl"
                :alt="branch.name"
                class="w-full h-full object-contain p-2"
              />
              <span v-else class="text-2xl font-bold text-primary">
                {{ getInitial(branch.name) }}
              </span>
            </div>

            <!-- Role Badge -->
            <span
              class="px-2.5 py-1 text-xs font-semibold rounded-full"
              :class="getRoleBadgeClass(branch.role)"
            >
              {{ formatRole(branch.role) }}
            </span>
          </div>

          <!-- Branch Name -->
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2 group-hover:text-primary transition-colors">
            {{ branch.name }}
          </h3>

          <!-- Arrow Indicator / Loading -->
          <div class="flex items-center text-gray-400 dark:text-slate-500 group-hover:text-primary transition-colors">
            <template v-if="selecting === branch.id">
              <svg class="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span class="text-sm text-primary">Loading...</span>
            </template>
            <template v-else>
              <span class="text-sm">Enter branch</span>
              <svg class="w-4 h-4 ml-2 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </template>
          </div>

          <!-- Hover Glow Effect -->
          <div class="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/5 to-orange-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
        </button>
      </div>

      <!-- No Branches -->
      <div v-else class="text-center py-12">
        <p class="text-gray-600 dark:text-slate-400 mb-4">
          You don't have access to any branches yet.
        </p>
        <button
          @click="handleSignOut"
          class="text-primary hover:text-primary/80 font-medium"
        >
          Sign out
        </button>
      </div>

      <!-- Sign Out Link -->
      <div class="text-center mt-8">
        <button
          @click="handleSignOut"
          class="text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300 text-sm font-medium transition-colors"
        >
          Sign out and use a different account
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore, type Branch } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const branches = ref<Branch[]>([])
const loading = ref(true)
const selecting = ref<string | null>(null) // Track which branch is being selected
const error = ref<string | null>(null)

onMounted(async () => {
  try {
    await authStore.fetchBranches()
    branches.value = authStore.branches

    // If only one branch, auto-select and redirect
    if (branches.value.length === 1) {
      await selectBranch(branches.value[0])
    }

    // If no branches, show message
    if (branches.value.length === 0) {
      error.value = 'You are not a member of any branches.'
    }
  } catch (err: any) {
    error.value = err.message || 'Failed to load branches'
  } finally {
    loading.value = false
  }
})

const selectBranch = async (branch: Branch) => {
  selecting.value = branch.id
  try {
    authStore.setActiveBranch(branch.id)
    // Refresh company data for the selected branch
    await authStore.fetchCompany()
    await authStore.fetchOnboardingStatus()
    router.push('/dashboard')
  } catch (err) {
    selecting.value = null
    error.value = 'Failed to load branch'
  }
}

const handleSignOut = async () => {
  await authStore.signOut()
  router.push('/login')
}

const getInitial = (name: string) => {
  return name.charAt(0).toUpperCase()
}

const formatRole = (role: string) => {
  return role.charAt(0).toUpperCase() + role.slice(1)
}

const getRoleBadgeClass = (role: string) => {
  switch (role) {
    case 'owner':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300'
    case 'admin':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-slate-700 dark:text-slate-300'
  }
}
</script>
