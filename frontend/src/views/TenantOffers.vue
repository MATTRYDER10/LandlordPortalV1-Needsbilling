<template>
  <Sidebar>
    <div class="p-8">
      <div class="mb-8">
        <div class="flex justify-between items-center mb-4">
          <div>
            <h2 class="text-3xl font-bold text-gray-900">Tenant Offers</h2>
            <p class="mt-2 text-gray-600">Manage rental property offers from tenants</p>
          </div>
          <button @click="showSendModal = true"
            class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md">
            Send Offer Form
          </button>
        </div>

        <!-- Stats -->
        <div class="grid grid-cols-1 gap-5 sm:grid-cols-4 mb-6">
          <div class="bg-white overflow-hidden shadow rounded-lg cursor-pointer hover:shadow-md transition-shadow"
            @click="statusFilter = ''">
            <div class="p-5">
              <div class="flex items-center justify-between">
                <div class="flex-1">
                  <div class="text-sm font-medium text-gray-500">Total Offers</div>
                  <div class="mt-1 text-3xl font-semibold text-gray-900">{{ offers.length }}</div>
                </div>
                <div class="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                  <svg class="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
          <div class="bg-white overflow-hidden shadow rounded-lg cursor-pointer hover:shadow-md transition-shadow"
            @click="statusFilter = 'pending'">
            <div class="p-5">
              <div class="flex items-center justify-between">
                <div class="flex-1">
                  <div class="text-sm font-medium text-gray-500">Pending</div>
                  <div class="mt-1 text-3xl font-semibold text-yellow-600">{{ statusCounts.pending }}</div>
                </div>
                <div class="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                  <svg class="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
          <div class="bg-white overflow-hidden shadow rounded-lg cursor-pointer hover:shadow-md transition-shadow"
            @click="statusFilter = 'approved'">
            <div class="p-5">
              <div class="flex items-center justify-between">
                <div class="flex-1">
                  <div class="text-sm font-medium text-gray-500">Approved</div>
                  <div class="mt-1 text-3xl font-semibold text-blue-600">{{ statusCounts.approved }}</div>
                </div>
                <div class="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
          <div class="bg-white overflow-hidden shadow rounded-lg cursor-pointer hover:shadow-md transition-shadow"
            @click="statusFilter = 'declined'">
            <div class="p-5">
              <div class="flex items-center justify-between">
                <div class="flex-1">
                  <div class="text-sm font-medium text-gray-500">Declined</div>
                  <div class="mt-1 text-3xl font-semibold text-red-600">{{ statusCounts.declined }}</div>
                </div>
                <div class="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Search and Filters -->
        <div class="space-y-3 mb-6">
          <div class="relative">
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input v-model="searchQuery" type="text" placeholder="Search by property address or tenant name..."
              class="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm" />
          </div>

          <div class="flex gap-3">
            <div class="flex-1">
              <select v-model="statusFilter"
                class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary sm:text-sm">
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="declined">Declined</option>
                <option value="accepted_with_changes">Accepted with Changes</option>
              </select>
            </div>
            <button v-if="statusFilter || searchQuery" @click="clearFilters"
              class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
              Clear Filters
            </button>
          </div>
        </div>

        <!-- Offers Table -->
        <div v-if="loading" class="bg-white rounded-lg shadow p-8 text-center">
          <div class="text-gray-600">Loading offers...</div>
        </div>

        <div v-else-if="filteredOffers.length === 0" class="bg-white rounded-lg shadow p-8 text-center">
          <p class="text-gray-500">No offers found</p>
        </div>

        <div v-else class="bg-white shadow overflow-hidden sm:rounded-md">
          <ul class="divide-y divide-gray-200">
            <li v-for="offer in filteredOffers" :key="offer.id" class="hover:bg-gray-50">
              <div class="px-6 py-4">
                <div class="flex items-center justify-between">
                  <div class="flex-1">
                    <div class="flex items-center">
                      <h3 class="text-lg font-medium text-gray-900">
                        {{ offer.property_address }}
                      </h3>
                      <span
                        class="ml-3 px-2 inline-flex text-xs leading-5 font-semibold rounded-full items-center gap-1"
                        :class="getStatusBadgeClass(offer)">
                        <span>{{ formatStatusDisplay(offer) }}</span>
                        <svg v-if="showStatusTick(offer)" class="w-3.5 h-3.5 text-green-700" fill="none"
                          stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                    </div>
                    <div v-if="offer.deposit_replacement_requested" class="mt-2">
                      <span
                        class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                        Deposit replacement service applied for
                      </span>
                    </div>
                    <div class="mt-2 text-sm text-gray-500">
                      <p><strong>Tenants:</strong> {{offer.tenants.map((t: any) => t.name).join(', ')}}</p>
                      <p><strong>Offered Rent:</strong> £{{ offer.offered_rent_amount }} per month</p>
                      <p><strong>Move-in Date:</strong> {{ formatDate(offer.proposed_move_in_date) }}</p>
                      <p><strong>Tenancy Length:</strong> {{ offer.proposed_tenancy_length_months }} months</p>
                      <p><strong>Submitted:</strong> {{ formatDate(offer.created_at) }}</p>
                    </div>
                  </div>
                  <div class="ml-4 flex-shrink-0 flex flex-col gap-2 items-end">
                    <button @click="viewOffer(offer.id)"
                      class="px-4 py-2 text-sm font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded-md">
                      View Details
                    </button>
                    <button @click="deleteOffer(offer.id)"
                      class="px-3 py-1 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-md">
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
    <!-- Send Offer Modal -->
    <SendOfferModal
      :show="showSendModal"
      @close="showSendModal = false"
      @sent="fetchOffers"
    />
  </Sidebar>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import Sidebar from '../components/Sidebar.vue'
import SendOfferModal from '../components/SendOfferModal.vue'
import { formatDate } from '../utils/date'

const router = useRouter()
const authStore = useAuthStore()
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const offers = ref<any[]>([])
const loading = ref(false)
const searchQuery = ref('')
const statusFilter = ref('')
const deletingId = ref<string | null>(null)
const showSendModal = ref(false)

const statusCounts = computed(() => {
  const counts = {
    pending: 0,
    approved: 0,
    declined: 0,
    accepted_with_changes: 0
  }

  for (const offer of offers.value) {
    switch (offer.status) {
      case 'pending':
        counts.pending++
        break
      case 'declined':
        counts.declined++
        break
      case 'accepted_with_changes':
        counts.accepted_with_changes++
        break
      case 'approved':
      case 'holding_deposit_received':
      case 'reference_created':
        counts.approved++
        break
      default:
        break
    }
  }

  return counts
})

const filteredOffers = computed(() => {
  let filtered = offers.value

  // Apply search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter((offer: any) => {
      const address = offer.property_address?.toLowerCase() || ''
      const tenantNames = offer.tenants?.map((t: any) => t.name?.toLowerCase() || '').join(' ') || ''
      return address.includes(query) || tenantNames.includes(query)
    })
  }

  // Apply status filter
  if (statusFilter.value) {
    const filterValue = statusFilter.value
    filtered = filtered.filter((offer: any) => {
      if (filterValue === 'approved') {
        return offer.status === 'approved' || offer.status === 'holding_deposit_received' || offer.status === 'reference_created'
      }
      return offer.status === filterValue
    })
  }

  return filtered
})

const formatStatus = (status: string) => {
  const statusMap: Record<string, string> = {
    pending: 'Pending',
    approved: 'Approved',
    declined: 'Declined',
    accepted_with_changes: 'Accepted with Changes'
  }

  if (status === 'holding_deposit_received' || status === 'reference_created') {
    return 'Approved'
  }

  return statusMap[status] || status
}

const formatStatusDisplay = (offer: any) => formatStatus(offer.status)

const showStatusTick = (offer: any) =>
  offer.holding_deposit_received ||
  offer.status === 'holding_deposit_received' ||
  offer.status === 'reference_created'

const getStatusBadgeClass = (offer: any) => {
  if (offer.status === 'approved') {
    return showStatusTick(offer) ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
  }

  if (offer.status === 'holding_deposit_received' || offer.status === 'reference_created') {
    return 'bg-green-100 text-green-800'
  }

  const map: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    declined: 'bg-red-100 text-red-800',
    accepted_with_changes: 'bg-purple-100 text-purple-800'
  }

  return map[offer.status] || 'bg-gray-100 text-gray-800'
}

const clearFilters = () => {
  searchQuery.value = ''
  statusFilter.value = ''
}

const viewOffer = (offerId: string) => {
  router.push(`/tenant-offers/${offerId}`)
}

const deleteOffer = async (offerId: string) => {
  if (!window.confirm('Are you sure you want to delete this offer? This action cannot be undone.')) {
    return
  }

  deletingId.value = offerId
  try {
    const token = authStore.session?.access_token
    if (!token) {
      router.push('/login')
      return
    }

    const response = await fetch(`${API_URL}/api/tenant-offers/${offerId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Failed to delete offer')
    }

    await fetchOffers()
  } catch (error: any) {
    console.error('Error deleting offer:', error)
    window.alert(error.message || 'Failed to delete offer')
  } finally {
    deletingId.value = null
  }
}

const fetchOffers = async () => {
  loading.value = true
  try {
    const token = authStore.session?.access_token
    if (!token) {
      router.push('/login')
      return
    }

    const response = await fetch(`${API_URL}/api/tenant-offers`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error('Failed to fetch offers')
    }

    const data = await response.json()
    offers.value = data.offers || []
  } catch (error: any) {
    console.error('Error fetching offers:', error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchOffers()
})
</script>
