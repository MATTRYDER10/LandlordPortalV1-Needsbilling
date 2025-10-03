<template>
  <Sidebar>
    <div class="p-8">
      <div class="mb-8">
        <h2 class="text-3xl font-bold text-gray-900">Dashboard</h2>
        <p class="mt-2 text-gray-600">Welcome to your tenant referencing dashboard</p>
      </div>

      <!-- Stats Cards -->
      <div class="grid grid-cols-1 md:grid-cols-5 gap-0 mb-8">
        <div class="bg-white shadow p-6 border-r border-gray-200 first:rounded-l-lg last:rounded-r-lg last:border-r-0">
          <div class="flex items-center">
            <div class="flex-1">
              <p class="text-sm font-medium text-gray-600">Total References</p>
              <p class="text-3xl font-bold text-gray-900">{{ totalReferences }}</p>
            </div>
            <div class="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
              <svg class="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
        </div>

        <div class="bg-white shadow p-6 border-r border-gray-200 first:rounded-l-lg last:rounded-r-lg last:border-r-0">
          <div class="flex items-center">
            <div class="flex-1">
              <p class="text-sm font-medium text-gray-600">In Progress</p>
              <p class="text-3xl font-bold text-primary">{{ inProgressReferences }}</p>
            </div>
            <div class="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
              <svg class="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div class="bg-white shadow p-6 border-r border-gray-200 first:rounded-l-lg last:rounded-r-lg last:border-r-0">
          <div class="flex items-center">
            <div class="flex-1">
              <p class="text-sm font-medium text-gray-600">Pending Verification</p>
              <p class="text-3xl font-bold text-orange-600">{{ pendingVerificationReferences }}</p>
            </div>
            <div class="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <svg class="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
          </div>
        </div>

        <div class="bg-white shadow p-6 border-r border-gray-200 first:rounded-l-lg last:rounded-r-lg last:border-r-0">
          <div class="flex items-center">
            <div class="flex-1">
              <p class="text-sm font-medium text-gray-600">Rejected</p>
              <p class="text-3xl font-bold text-red-600">{{ rejectedReferences }}</p>
            </div>
            <div class="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          </div>
        </div>

        <div class="bg-white shadow p-6 border-r border-gray-200 first:rounded-l-lg last:rounded-r-lg last:border-r-0">
          <div class="flex items-center">
            <div class="flex-1">
              <p class="text-sm font-medium text-gray-600">Completed</p>
              <p class="text-3xl font-bold text-green-600">{{ completedReferences }}</p>
            </div>
            <div class="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <!-- Recent References -->
      <div class="bg-white rounded-lg shadow">
        <div class="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 class="text-lg font-semibold text-gray-900">Recent References</h3>
          <router-link
            to="/references"
            class="text-sm font-medium text-primary hover:text-primary/80"
          >
            View All →
          </router-link>
        </div>

        <!-- Empty State -->
        <div v-if="recentReferences.length === 0" class="p-6">
          <div class="text-center py-12">
            <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 class="mt-2 text-sm font-medium text-gray-900">No references yet</h3>
            <p class="mt-1 text-sm text-gray-500">Get started by creating a new tenant reference.</p>
            <div class="mt-6">
              <router-link
                to="/references"
                class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md inline-block"
              >
                Create New Reference
              </router-link>
            </div>
          </div>
        </div>

        <!-- References Table -->
        <div v-else class="overflow-hidden">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tenant</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Property</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="reference in recentReferences" :key="reference.id" class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm font-medium text-gray-900">
                    {{ reference.tenant_first_name }} {{ reference.tenant_last_name }}
                  </div>
                  <div class="text-sm text-gray-500">{{ reference.tenant_email }}</div>
                </td>
                <td class="px-6 py-4">
                  <div class="text-sm text-gray-900">{{ reference.property_address }}</div>
                  <div class="text-sm text-gray-500">
                    {{ reference.property_city }}{{ reference.property_postcode ? ', ' + reference.property_postcode : '' }}
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span
                    class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full"
                    :class="{
                      'bg-yellow-100 text-yellow-800': reference.status === 'pending',
                      'bg-blue-100 text-blue-800': reference.status === 'in_progress',
                      'bg-orange-100 text-orange-800': reference.status === 'pending_verification',
                      'bg-green-100 text-green-800': reference.status === 'completed',
                      'bg-red-100 text-red-800': reference.status === 'rejected',
                      'bg-gray-100 text-gray-800': reference.status === 'cancelled'
                    }"
                  >
                    {{ formatStatus(reference.status) }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {{ formatDate(reference.created_at) }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    @click="viewReference(reference.id)"
                    class="text-primary hover:text-primary/80"
                  >
                    View
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </Sidebar>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import Sidebar from '../components/Sidebar.vue'

const router = useRouter()
const authStore = useAuthStore()
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const totalReferences = ref(0)
const inProgressReferences = ref(0)
const pendingVerificationReferences = ref(0)
const rejectedReferences = ref(0)
const completedReferences = ref(0)
const recentReferences = ref<any[]>([])

const fetchReferences = async () => {
  try {
    const token = authStore.session?.access_token
    if (!token) return

    const response = await fetch(`${API_URL}/api/references`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) return

    const data = await response.json()
    const references = data.references || []

    totalReferences.value = references.length
    inProgressReferences.value = references.filter((ref: any) =>
      ref.status === 'pending' || ref.status === 'in_progress'
    ).length
    pendingVerificationReferences.value = references.filter((ref: any) =>
      ref.status === 'pending_verification'
    ).length
    rejectedReferences.value = references.filter((ref: any) =>
      ref.status === 'rejected'
    ).length
    completedReferences.value = references.filter((ref: any) =>
      ref.status === 'completed'
    ).length

    // Show 5 most recent references
    recentReferences.value = references
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5)
  } catch (error) {
    console.error('Failed to fetch references:', error)
  }
}

const viewReference = (id: string) => {
  router.push(`/references/${id}`)
}

const formatStatus = (status: string) => {
  return status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
}

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

onMounted(() => {
  fetchReferences()
})
</script>
