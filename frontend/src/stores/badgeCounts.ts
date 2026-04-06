import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useAuthStore } from './auth'

const API_URL = import.meta.env.VITE_API_URL ?? ''

export const useBadgeCountsStore = defineStore('badgeCounts', () => {
  const pendingOffers = ref(0)
  const readyTenancies = ref(0)
  let pollInterval: ReturnType<typeof setInterval> | null = null

  const fetch = async () => {
    const authStore = useAuthStore()
    const token = authStore.session?.access_token
    if (!token) return

    try {
      const res = await window.fetch(`${API_URL}/api/notifications/badge-counts`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) return
      const data = await res.json()
      pendingOffers.value = data.pending_offers ?? 0
      readyTenancies.value = data.ready_tenancies ?? 0
    } catch {
      // silent fail
    }
  }

  const startPolling = () => {
    fetch()
    if (!pollInterval) {
      pollInterval = setInterval(fetch, 5 * 60 * 1000)
    }
  }

  const stopPolling = () => {
    if (pollInterval) {
      clearInterval(pollInterval)
      pollInterval = null
    }
  }

  return { pendingOffers, readyTenancies, fetch, startPolling, stopPolling }
})
