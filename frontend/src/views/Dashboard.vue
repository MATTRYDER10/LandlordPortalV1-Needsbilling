<template>
  <Sidebar>
    <div class="p-8">
      <div class="mb-8">
        <h2 class="text-3xl font-bold text-gray-900">Dashboard</h2>
        <p class="mt-2 text-gray-600">Welcome to your tenant referencing dashboard</p>
      </div>

      <!-- Stats Cards -->
      <div class="grid grid-cols-1 md:grid-cols-5 gap-0 mb-8">
        <router-link to="/references"
          class="bg-white shadow p-6 border-r border-gray-200 first:rounded-l-lg last:rounded-r-lg last:border-r-0 hover:bg-gray-50 transition-colors cursor-pointer">
          <div class="flex items-center">
            <div class="flex-1">
              <p class="text-sm font-medium text-gray-600">Total References</p>
              <p class="text-3xl font-bold text-gray-900">{{ totalReferences }}</p>
            </div>
            <div class="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
              <FileText class="w-6 h-6 text-primary" />
            </div>
          </div>
        </router-link>

        <router-link :to="{ path: '/references', query: { status: 'in_progress' } }"
          class="bg-white shadow p-6 border-r border-gray-200 first:rounded-l-lg last:rounded-r-lg last:border-r-0 hover:bg-gray-50 transition-colors cursor-pointer">
          <div class="flex items-center">
            <div class="flex-1">
              <p class="text-sm font-medium text-gray-600">In Progress</p>
              <p class="text-3xl font-bold text-primary">{{ inProgressReferences }}</p>
            </div>
            <div class="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
              <Clock class="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </router-link>

        <router-link :to="{ path: '/references', query: { status: 'pending_verification' } }"
          class="bg-white shadow p-6 border-r border-gray-200 first:rounded-l-lg last:rounded-r-lg last:border-r-0 hover:bg-gray-50 transition-colors cursor-pointer">
          <div class="flex items-center">
            <div class="flex-1">
              <p class="text-sm font-medium text-gray-600">Pending Verification</p>
              <p class="text-3xl font-bold text-orange-600">{{ pendingVerificationReferences }}</p>
            </div>
            <div class="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <ClipboardCheck class="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </router-link>

        <router-link :to="{ path: '/references', query: { status: 'rejected' } }"
          class="bg-white shadow p-6 border-r border-gray-200 first:rounded-l-lg last:rounded-r-lg last:border-r-0 hover:bg-gray-50 transition-colors cursor-pointer">
          <div class="flex items-center">
            <div class="flex-1">
              <p class="text-sm font-medium text-gray-600">Rejected</p>
              <p class="text-3xl font-bold text-red-600">{{ rejectedReferences }}</p>
            </div>
            <div class="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <X class="w-6 h-6 text-red-600" />
            </div>
          </div>
        </router-link>

        <router-link :to="{ path: '/references', query: { status: 'completed' } }"
          class="bg-white shadow p-6 border-r border-gray-200 first:rounded-l-lg last:rounded-r-lg last:border-r-0 hover:bg-gray-50 transition-colors cursor-pointer">
          <div class="flex items-center">
            <div class="flex-1">
              <p class="text-sm font-medium text-gray-600">Completed</p>
              <p class="text-3xl font-bold text-green-600">{{ completedReferences }}</p>
            </div>
            <div class="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle class="w-6 h-6 text-green-600" />
            </div>
          </div>
        </router-link>
      </div>

      <!-- Quick Actions -->
      <div class="mb-8">
        <div class="bg-white rounded-lg shadow p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div class="flex flex-wrap gap-4">
            <router-link to="/references?create=true"
              class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md inline-block">
              Create Reference
            </router-link>
            <router-link to="/agreements/generate"
              class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md inline-block">
              Create Agreement
            </router-link>
            <router-link to="/landlords?add=true"
              class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md inline-block">
              Add Landlord
            </router-link>
          </div>
          <p class="mt-3 text-sm text-gray-600">
            Quickly create tenant references, add landlord details, or send offer forms to tenants. Offer
            forms allow tenants to fill in their offer details directly, saving you time on data entry. Once they
            submit, you can approve, decline, or accept with changes, then collect holding deposits and automatically
            create references.
          </p>
        </div>
      </div>

      <!-- Recent References -->
      <div class="bg-white rounded-lg shadow">
        <div class="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 class="text-lg font-semibold text-gray-900">Recent References</h3>
          <router-link to="/references" class="text-sm font-medium text-primary hover:text-primary/80">
            View All →
          </router-link>
        </div>

        <!-- Empty State -->
        <div v-if="recentReferences.length === 0" class="p-6">
          <div class="text-center py-12">
            <FileText class="mx-auto h-12 w-12 text-gray-400" />
            <h3 class="mt-2 text-sm font-medium text-gray-900">No references yet</h3>
            <p class="mt-1 text-sm text-gray-500">Get started by creating a new tenant reference.</p>
            <div class="mt-6">
              <router-link to="/references?create=true"
                class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md inline-block">
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
              <template v-for="reference in recentReferences" :key="reference.id">
                <!-- Main tenant row -->
                <tr class="hover:bg-gray-50">
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900">
                      {{ reference.tenant_first_name }} {{ reference.tenant_last_name }}
                    </div>
                    <div class="text-sm text-gray-500">{{ reference.tenant_email }}</div>
                  </td>
                  <td class="px-6 py-4">
                    <div class="text-sm text-gray-900">{{ reference.property_address }}</div>
                    <div class="text-sm text-gray-500">
                      {{ reference.property_city }}{{ reference.property_postcode ? ', ' + reference.property_postcode :
                      '' }}
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full" :class="{
                      'bg-yellow-100 text-yellow-800': reference.status === 'pending',
                      'bg-blue-100 text-blue-800': reference.status === 'in_progress',
                      'bg-orange-100 text-orange-800': reference.status === 'pending_verification',
                      'bg-green-100 text-green-800': reference.status === 'completed',
                      'bg-red-100 text-red-800': reference.status === 'rejected',
                      'bg-gray-100 text-gray-800': reference.status === 'cancelled'
                    }">
                      {{ formatStatus(reference.status) }}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {{ formatDate(reference.created_at) }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button @click="viewReference(reference.id)" class="text-primary hover:text-primary/80">
                      View
                    </button>
                  </td>
                </tr>
                <!-- Nested guarantor rows -->
                <tr v-for="guarantor in reference.guarantors" :key="guarantor.id"
                  class="bg-purple-50 hover:bg-purple-100">
                  <td class="px-6 py-4 whitespace-nowrap pl-12">
                    <div class="text-sm font-medium text-purple-900 flex items-center">
                      <span class="mr-2">↳</span>
                      {{ guarantor.tenant_first_name }} {{ guarantor.tenant_last_name }}
                      <span
                        class="ml-2 px-2 py-0.5 text-xs font-semibold rounded-full bg-purple-200 text-purple-800">Guarantor</span>
                    </div>
                    <div class="text-sm text-purple-700 pl-4">{{ guarantor.tenant_email }}</div>
                  </td>
                  <td class="px-6 py-4">
                    <div class="text-sm text-purple-900">{{ guarantor.property_address }}</div>
                    <div class="text-sm text-purple-700">
                      {{ guarantor.property_city }}{{ guarantor.property_postcode ? ', ' + guarantor.property_postcode :
                      '' }}
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full" :class="{
                      'bg-yellow-100 text-yellow-800': guarantor.status === 'pending',
                      'bg-blue-100 text-blue-800': guarantor.status === 'in_progress',
                      'bg-orange-100 text-orange-800': guarantor.status === 'pending_verification',
                      'bg-green-100 text-green-800': guarantor.status === 'completed',
                      'bg-red-100 text-red-800': guarantor.status === 'rejected',
                      'bg-gray-100 text-gray-800': guarantor.status === 'cancelled'
                    }">
                      {{ formatStatus(guarantor.status) }}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-purple-700">
                    {{ formatDate(guarantor.created_at) }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button @click="viewReference(guarantor.id)" class="text-purple-600 hover:text-purple-800">
                      View
                    </button>
                  </td>
                </tr>
              </template>
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
import { formatDate as formatUkDate } from '../utils/date'
import {
  FileText,
  Clock,
  ClipboardCheck,
  X,
  CheckCircle
} from 'lucide-vue-next'

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

    // Fetch stats and recent references in parallel for better performance
    const [statsResponse, refsResponse] = await Promise.all([
      // Fetch stats from dedicated endpoint (6 COUNT queries instead of fetching all data)
      fetch(`${API_URL}/api/references/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }),
      // Fetch only 5 most recent references (with limit param)
      fetch(`${API_URL}/api/references?page=1&limit=10`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
    ])

    if (statsResponse.status === 404 || refsResponse.status === 404) {
      // User no longer has access to company (likely removed from team)
      console.log('User no longer has access, logging out...')
      await authStore.signOut()
      router.push('/login')
      return
    }

    // Process stats
    if (statsResponse.ok) {
      const stats = await statsResponse.json()
      totalReferences.value = stats.total || 0
      inProgressReferences.value = stats.inProgress || 0
      pendingVerificationReferences.value = stats.pendingVerification || 0
      completedReferences.value = stats.completed || 0
      rejectedReferences.value = stats.rejected || 0
    }

    // Process recent references
    if (refsResponse.ok) {
      const data = await refsResponse.json()
      const allReferences = data.references || []

      // Attach guarantors to their parent references
      const guarantorMap = new Map()
      allReferences.forEach((ref: any) => {
        if (ref.is_guarantor && ref.guarantor_for_reference_id) {
          if (!guarantorMap.has(ref.guarantor_for_reference_id)) {
            guarantorMap.set(ref.guarantor_for_reference_id, [])
          }
          guarantorMap.get(ref.guarantor_for_reference_id).push(ref)
        }
      })

      // Attach guarantors array to parent references and filter out standalone guarantors
      const references = allReferences
        .filter((ref: any) => !ref.is_guarantor)
        .map((ref: any) => ({
          ...ref,
          guarantors: guarantorMap.get(ref.id) || []
        }))

      // Already sorted by created_at desc from backend, just take first 5
      recentReferences.value = references.slice(0, 5)
    }
  } catch (error) {
    console.error('Failed to fetch references:', error)
  }
}

const viewReference = (id: string) => {
  router.push(`/references?person=${id}`)
}

const formatStatus = (status: string) => {
  return status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
}

const formatDate = (date?: string | null, fallback = 'N/A') =>
  formatUkDate(
    date,
    {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    },
    fallback
  )

onMounted(() => {
  fetchReferences()
})
</script>
