import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'
import { useAuthStore } from './auth'

const API_URL = import.meta.env.VITE_API_URL ?? ''

export interface CreditBalance {
  company_id: string
  credits: number
  can_create_reference: boolean
  auto_recharge_enabled?: boolean
  auto_recharge_threshold?: number
  auto_recharge_pack_size?: number
}

export interface SubscriptionTier {
  id: string
  product_key: string
  product_name: string
  description: string
  credits_quantity: number
  price_per_credit: number
  price_gbp: number
  is_popular: boolean
  is_recommended: boolean
  stripe_price_id?: string
}

export interface CreditPack {
  id: string
  product_key: string
  product_name: string
  description: string
  credits_quantity: number
  price_per_credit: number
  price_gbp: number
  is_recommended: boolean
}

export interface CreditTransaction {
  id: string
  company_id: string
  type: string
  credits_change: number
  credits_balance_after: number
  amount_gbp?: number
  description: string
  created_at: string
}

export interface Subscription {
  id: string
  company_id: string
  stripe_subscription_id: string
  tier: string
  credits_per_month: number
  price_per_credit: number
  monthly_total: number
  status: string
  current_period_start: string
  current_period_end: string
  cancel_at_period_end: boolean
  canceled_at?: string
}

export const useBillingStore = defineStore('billing', () => {
  // State
  const creditBalance = ref<CreditBalance | null>(null)
  const subscriptionTiers = ref<SubscriptionTier[]>([])
  const creditPacks = ref<CreditPack[]>([])
  const activeSubscription = ref<Subscription | null>(null)
  const transactions = ref<CreditTransaction[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Helper to get auth token
  const getAuthToken = () => {
    const authStore = useAuthStore()
    return authStore.session?.access_token
  }

  // Computed
  const hasCredits = computed(() => creditBalance.value?.credits ?? 0 > 0)
  const creditsCount = computed(() => creditBalance.value?.credits ?? 0)
  const hasActiveSubscription = computed(() =>
    activeSubscription.value?.status === 'active' || activeSubscription.value?.status === 'trialing'
  )
  const isLowCredits = computed(() => creditsCount.value <= 5)

  // Actions
  async function fetchCreditBalance() {
    const authStore = useAuthStore()
    if (!authStore.company || !authStore.session?.access_token) return null

    try {
      loading.value = true
      error.value = null
      const response = await axios.get(`${API_URL}/api/billing/credits`, {
        headers: {
          Authorization: `Bearer ${getAuthToken()}`
        }
      })
      creditBalance.value = response.data
      return response.data
    } catch (err: any) {
      // Don't throw on auth errors -- token may have expired
      if (err.response?.status === 403 || err.response?.status === 401) return null
      error.value = err.response?.data?.error || 'Failed to fetch credit balance'
      console.error('Error fetching credit balance:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  async function fetchSubscriptionTiers() {
    try {
      const response = await axios.get(`${API_URL}/api/billing/pricing/subscriptions`, {
        headers: {
          Authorization: `Bearer ${getAuthToken()}`
        }
      })
      subscriptionTiers.value = response.data
      return response.data
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to fetch subscription tiers'
      console.error('Error fetching subscription tiers:', err)
      throw err
    }
  }

  async function fetchCreditPacks() {
    try {
      const response = await axios.get(`${API_URL}/api/billing/pricing/packs`, {
        headers: {
          Authorization: `Bearer ${getAuthToken()}`
        }
      })
      creditPacks.value = response.data
      return response.data
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to fetch credit packs'
      console.error('Error fetching credit packs:', err)
      throw err
    }
  }

  async function fetchActiveSubscription() {
    try {
      const response = await axios.get(`${API_URL}/api/billing/subscriptions/active`, {
        headers: {
          Authorization: `Bearer ${getAuthToken()}`
        },
        validateStatus: (status) => {
          // Treat 404 as success since it's expected when no subscription exists
          return (status >= 200 && status < 300) || status === 404
        }
      })

      // If 404, no active subscription exists
      if (response.status === 404) {
        activeSubscription.value = null
        return null
      }

      activeSubscription.value = response.data
      return response.data
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to fetch subscription'
      console.error('Error fetching subscription:', err)
      throw err
    }
  }

  async function fetchTransactions(limit: number = 50, offset: number = 0) {
    try {
      const response = await axios.get(`${API_URL}/api/billing/transactions`, {
        params: { limit, offset },
        headers: {
          Authorization: `Bearer ${getAuthToken()}`
        }
      })
      transactions.value = response.data.transactions
      return response.data
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to fetch transactions'
      console.error('Error fetching transactions:', err)
      throw err
    }
  }

  async function purchaseCreditPack(packProductKey: string) {
    try {
      loading.value = true
      error.value = null
      const response = await axios.post(
        `${API_URL}/api/billing/credits/purchase`,
        { pack_product_key: packProductKey },
        {
          headers: {
            Authorization: `Bearer ${getAuthToken()}`
          }
        }
      )
      return response.data
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to purchase credit pack'
      console.error('Error purchasing credit pack:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  async function createSubscription(tierProductKey: string) {
    try {
      loading.value = true
      error.value = null
      const response = await axios.post(
        `${API_URL}/api/billing/subscriptions`,
        { tier_product_key: tierProductKey },
        {
          headers: {
            Authorization: `Bearer ${getAuthToken()}`
          }
        }
      )
      return response.data
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to create subscription'
      console.error('Error creating subscription:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  async function cancelSubscription(cancelAtPeriodEnd: boolean = true) {
    try {
      loading.value = true
      error.value = null
      const response = await axios.delete(`${API_URL}/api/billing/subscriptions`, {
        data: { cancel_at_period_end: cancelAtPeriodEnd },
        headers: {
          Authorization: `Bearer ${getAuthToken()}`
        }
      })
      await fetchActiveSubscription()
      return response.data
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to cancel subscription'
      console.error('Error canceling subscription:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  async function savePaymentMethod(paymentMethodId: string) {
    try {
      loading.value = true
      error.value = null
      const response = await axios.post(
        `${API_URL}/api/billing/payment-methods`,
        { payment_method_id: paymentMethodId },
        {
          headers: {
            Authorization: `Bearer ${getAuthToken()}`
          }
        }
      )
      return response.data
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to save payment method'
      console.error('Error saving payment method:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  async function updateAutoRecharge(settings: {
    enabled: boolean
    threshold?: number
    pack_size?: number
  }) {
    try {
      loading.value = true
      error.value = null
      const response = await axios.put(
        `${API_URL}/api/billing/auto-recharge`,
        settings,
        {
          headers: {
            Authorization: `Bearer ${getAuthToken()}`
          }
        }
      )
      return response.data
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to update auto-recharge settings'
      console.error('Error updating auto-recharge:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  // Initialize
  async function initialize() {
    try {
      await Promise.all([
        fetchCreditBalance(),
        fetchSubscriptionTiers(),
        fetchCreditPacks(),
        fetchActiveSubscription()
      ])
    } catch (err) {
      console.error('Error initializing billing store:', err)
    }
  }

  return {
    // State
    creditBalance,
    subscriptionTiers,
    creditPacks,
    activeSubscription,
    transactions,
    loading,
    error,

    // Computed
    hasCredits,
    creditsCount,
    hasActiveSubscription,
    isLowCredits,

    // Actions
    fetchCreditBalance,
    fetchSubscriptionTiers,
    fetchCreditPacks,
    fetchActiveSubscription,
    fetchTransactions,
    purchaseCreditPack,
    createSubscription,
    cancelSubscription,
    savePaymentMethod,
    updateAutoRecharge,
    initialize
  }
})
