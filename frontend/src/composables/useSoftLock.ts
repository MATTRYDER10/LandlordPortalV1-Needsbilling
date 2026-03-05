import { ref, computed, onUnmounted } from 'vue'
import type { LockStatus } from '@/types/staff'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
const HEARTBEAT_INTERVAL = 5 * 60 * 1000 // 5 minutes

export function useSoftLock(workItemId: string, token: string) {
  const lockStatus = ref<LockStatus | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null

  const isLocked = computed(() => lockStatus.value?.isLocked ?? false)
  const isLockedByMe = computed(() => lockStatus.value?.isLockedByMe ?? false)
  const isReadOnly = computed(() => isLocked.value && !isLockedByMe.value)
  const lockedByName = computed(() => lockStatus.value?.lock?.lockedByName || null)

  async function checkLockStatus() {
    try {
      const response = await fetch(`${API_BASE}/work-queue/${workItemId}/lock/status`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error('Failed to check lock status')
      }

      const data = await response.json()
      lockStatus.value = data
      return data
    } catch (err: any) {
      console.error('Failed to check lock status:', err)
      error.value = err.message
      return null
    }
  }

  async function acquireLock(): Promise<boolean> {
    loading.value = true
    error.value = null

    try {
      const response = await fetch(`${API_BASE}/work-queue/${workItemId}/lock/claim`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()

      if (!response.ok) {
        // Lock held by someone else
        if (response.status === 409) {
          lockStatus.value = {
            isLocked: true,
            isLockedByMe: false,
            lock: data.existingLock
          }
          error.value = data.error || 'Work item is locked by another user'
          return false
        }
        throw new Error(data.error || 'Failed to acquire lock')
      }

      lockStatus.value = {
        isLocked: true,
        isLockedByMe: true,
        lock: data.lock
      }

      // Start heartbeat
      startHeartbeat()
      return true
    } catch (err: any) {
      console.error('Failed to acquire lock:', err)
      error.value = err.message
      return false
    } finally {
      loading.value = false
    }
  }

  async function releaseLock(): Promise<boolean> {
    loading.value = true
    error.value = null

    try {
      // Stop heartbeat
      stopHeartbeat()

      const response = await fetch(`${API_BASE}/work-queue/${workItemId}/lock/release`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to release lock')
      }

      lockStatus.value = {
        isLocked: false,
        isLockedByMe: false
      }
      return true
    } catch (err: any) {
      console.error('Failed to release lock:', err)
      error.value = err.message
      return false
    } finally {
      loading.value = false
    }
  }

  async function extendLock(): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE}/work-queue/${workItemId}/lock/heartbeat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const data = await response.json()
        // Lock might have expired, try to re-acquire
        if (response.status === 400) {
          console.warn('Lock expired, attempting to re-acquire')
          return await acquireLock()
        }
        throw new Error(data.error || 'Failed to extend lock')
      }

      const data = await response.json()
      lockStatus.value = {
        isLocked: true,
        isLockedByMe: true,
        lock: data.lock
      }
      return true
    } catch (err: any) {
      console.error('Failed to extend lock:', err)
      return false
    }
  }

  function startHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer)
    }
    heartbeatTimer = setInterval(() => {
      if (isLockedByMe.value) {
        extendLock()
      }
    }, HEARTBEAT_INTERVAL)
  }

  function stopHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = null
    }
  }

  // Auto-release lock on unmount
  onUnmounted(() => {
    stopHeartbeat()
    if (isLockedByMe.value) {
      releaseLock()
    }
  })

  return {
    lockStatus,
    loading,
    error,
    isLocked,
    isLockedByMe,
    isReadOnly,
    lockedByName,
    checkLockStatus,
    acquireLock,
    releaseLock,
    extendLock
  }
}
