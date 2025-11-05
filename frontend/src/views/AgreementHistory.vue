<template>
  <div class="p-8">
    <div class="mb-8">
      <h2 class="text-3xl font-bold text-gray-900">Agreement History</h2>
      <p class="mt-2 text-gray-600">View and download previously generated agreements</p>
    </div>

    <!-- Search Box -->
    <div class="mb-6">
      <div class="relative">
        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          v-model="searchQuery"
          type="text"
          class="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm"
          placeholder="Search by property address or tenant name..."
        />
      </div>
    </div>

    <!-- Agreements Table -->
    <div class="bg-white rounded-lg shadow">
      <div v-if="loadingAgreements" class="text-center py-12">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p class="mt-2 text-gray-600">Loading agreements...</p>
      </div>

      <div v-else-if="filteredAgreements.length === 0" class="text-center py-12">
        <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p class="mt-2 text-gray-600">{{ searchQuery ? 'No agreements match your search' : 'No agreements created yet' }}</p>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Property Address
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tenant(s)
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Template
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="agreement in filteredAgreements" :key="agreement.id" class="hover:bg-gray-50">
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm font-medium text-gray-900">
                  {{ formatPropertyAddress(agreement.property_address) }}
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900">
                  {{ getTenantNames(agreement.tenants) }}
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                  {{ formatTemplateType(agreement.template_type) }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {{ new Date(agreement.created_at).toLocaleDateString('en-GB') }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button
                  @click="downloadAgreement(agreement.pdf_url)"
                  :disabled="!agreement.pdf_url"
                  class="text-primary hover:text-primary-dark disabled:text-gray-400 disabled:cursor-not-allowed"
                  :title="agreement.pdf_url ? 'Download PDF' : 'PDF not available'"
                >
                  <svg class="h-5 w-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useToast } from 'vue-toastification'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()
const toast = useToast()

const agreements = ref<any[]>([])
const loadingAgreements = ref(false)
const searchQuery = ref('')

const filteredAgreements = computed(() => {
  if (!searchQuery.value) return agreements.value

  const query = searchQuery.value.toLowerCase()
  return agreements.value.filter((agreement) => {
    const address = formatPropertyAddress(agreement.property_address).toLowerCase()
    const tenants = getTenantNames(agreement.tenants).toLowerCase()
    return address.includes(query) || tenants.includes(query)
  })
})

const fetchAgreements = async () => {
  loadingAgreements.value = true
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/agreements`, {
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    })

    if (!response.ok) {
      throw new Error('Failed to fetch agreements')
    }

    const data = await response.json()
    agreements.value = data.agreements || []
  } catch (err: any) {
    console.error('Error fetching agreements:', err)
    toast.error('Failed to load agreement history')
  } finally {
    loadingAgreements.value = false
  }
}

const formatPropertyAddress = (address: any): string => {
  if (!address) return 'N/A'
  if (typeof address === 'string') return address

  const parts = [
    address.line1,
    address.line2,
    address.city,
    address.postcode
  ].filter(Boolean)

  return parts.join(', ')
}

const getTenantNames = (tenants: any[]): string => {
  if (!tenants || tenants.length === 0) return 'N/A'
  return tenants.map(t => t.name).join(', ')
}

const formatTemplateType = (type: string): string => {
  const labels: Record<string, string> = {
    'dps': 'DPS',
    'mydeposits': 'Mydeposits',
    'tds': 'TDS',
    'reposit': 'Reposit',
    'no_deposit': 'No Deposit'
  }
  return labels[type] || type
}

const downloadAgreement = async (pdfUrl: string) => {
  if (!pdfUrl) {
    toast.error('PDF not available')
    return
  }

  try {
    // Create a temporary anchor element to trigger download
    const link = document.createElement('a')
    link.href = pdfUrl
    link.download = pdfUrl.split('/').pop() || 'agreement.pdf'
    link.target = '_blank'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } catch (err) {
    console.error('Error downloading agreement:', err)
    toast.error('Failed to download agreement')
  }
}

onMounted(() => {
  fetchAgreements()
})
</script>
