/**
 * Authenticated fetch wrapper that includes branch isolation headers
 * and automatic token refresh on 403 errors.
 * Use this instead of raw fetch() for API calls to ensure proper multi-branch isolation.
 */

import { supabase } from './supabase'

const SESSION_STORAGE_KEY = 'adminCompanyOverride'
const ACTIVE_BRANCH_KEY = 'activeBranchId'

// Singleton in-flight refresh promise — prevents thundering herd on concurrent 403s
let _refreshPromise: Promise<string | null> | null = null

/**
 * Attempts a Supabase token refresh. Returns the new access_token, or null if refresh fails.
 * Concurrent callers share the same in-flight promise.
 */
export async function refreshAndGetToken(): Promise<string | null> {
  if (!_refreshPromise) {
    _refreshPromise = (async () => {
      try {
        const { data, error } = await supabase.auth.refreshSession()
        if (error || !data.session) return null

        // Lazy import avoids circular dependency
        const { useAuthStore } = await import('../stores/auth')
        const authStore = useAuthStore()
        authStore.session = data.session

        return data.session.access_token
      } catch {
        return null
      } finally {
        _refreshPromise = null
      }
    })()
  }
  return _refreshPromise
}

export function getAuthHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {}

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  try {
    // First, check for admin company override (takes priority)
    const stored = sessionStorage.getItem(SESSION_STORAGE_KEY)
    if (stored) {
      const data = JSON.parse(stored)
      if (data.id) {
        headers['X-Admin-Company-Id'] = data.id
        // Don't add branch header when admin override is active
        return headers
      }
    }

    // If no admin override, add branch isolation header for multi-branch users
    const activeBranchId = localStorage.getItem(ACTIVE_BRANCH_KEY)
    if (activeBranchId) {
      headers['X-Branch-Id'] = activeBranchId
    }
  } catch (e) {
    // Ignore errors reading from storage
  }

  return headers
}

/**
 * Get a fresh access token from Supabase, triggering a refresh if needed.
 */
async function getFreshToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

/**
 * Wrapper around fetch that automatically includes auth and branch headers.
 * On 403 "Invalid token", refreshes the session and retries once.
 */
export async function authFetch(
  url: string,
  options: RequestInit & { token?: string } = {}
): Promise<Response> {
  const { token, headers: customHeaders, ...restOptions } = options

  // Use provided token, or get a fresh one from Supabase
  const effectiveToken = token || await getFreshToken()

  const authHeaders = getAuthHeaders(effectiveToken || undefined)

  const mergedHeaders: Record<string, string> = {
    ...authHeaders,
    ...(customHeaders as Record<string, string> || {})
  }

  // Auto-add Content-Type for JSON bodies
  if (restOptions.body && typeof restOptions.body === 'string' && !mergedHeaders['Content-Type']) {
    mergedHeaders['Content-Type'] = 'application/json'
  }

  const response = await fetch(url, { ...restOptions, headers: mergedHeaders })

  // If 403 "Invalid token", attempt one refresh + retry
  if (response.status === 403) {
    let body: any
    try { body = await response.clone().json() } catch { body = {} }

    if (body?.error === 'Invalid token') {
      const newToken = await refreshAndGetToken()
      if (!newToken) {
        if (window.location.pathname !== '/login' && window.location.pathname !== '/staff/login') {
          window.location.href = '/login'
        }
        return response
      }
      const retryHeaders = { ...mergedHeaders, Authorization: `Bearer ${newToken}` }
      return fetch(url, { ...restOptions, headers: retryHeaders })
    }
  }

  return response
}

export default authFetch
