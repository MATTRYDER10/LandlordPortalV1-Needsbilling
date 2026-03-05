import { useAuthStore } from '@/stores/auth'
import { useAdminCompanyStore } from '@/stores/adminCompany'

// In dev mode, determine the correct API URL based on the access method
const getApiUrl = () => {
  if (!import.meta.env.DEV) {
    return import.meta.env.VITE_API_URL || 'http://localhost:3001'
  }

  const hostname = window.location.hostname

  // If accessed via ngrok or other tunnels, use localhost for API
  // (ngrok only tunnels the frontend, backend is still on localhost)
  if (hostname.includes('ngrok') || hostname.includes('loca.lt') || hostname.includes('.dev')) {
    return 'http://localhost:3001'
  }

  // For local network access (e.g., 192.168.1.81), use the same IP
  return `http://${hostname}:3001`
}

const API_URL = getApiUrl()

/**
 * Composable for making API calls with automatic authentication
 * and admin company override support.
 *
 * When an admin has selected a company to view, the X-Admin-Company-Id
 * header is automatically included in all requests.
 */
export function useApi() {
  const authStore = useAuthStore()
  const adminCompanyStore = useAdminCompanyStore()

  /**
   * Build headers for API requests, including auth and optional admin override
   */
  function getHeaders(additionalHeaders?: Record<string, string>): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...additionalHeaders
    }

    // Add auth token if available
    const token = authStore.session?.access_token
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    // Add admin company override if active
    if (adminCompanyStore.isOverrideActive && adminCompanyStore.selectedCompanyId) {
      headers['X-Admin-Company-Id'] = adminCompanyStore.selectedCompanyId
    }

    // Add active branch ID for multi-branch support
    const activeBranchId = localStorage.getItem('activeBranchId')
    if (activeBranchId && !headers['X-Admin-Company-Id']) {
      headers['X-Branch-Id'] = activeBranchId
    }

    return headers
  }

  /**
   * Make a fetch request with automatic auth and admin override headers
   */
  async function apiFetch(
    path: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const { headers: customHeaders, ...restOptions } = options

    // Merge custom headers with base headers
    const mergedHeaders = getHeaders(customHeaders as Record<string, string>)

    // Handle FormData - remove Content-Type to let browser set it with boundary
    if (options.body instanceof FormData) {
      delete (mergedHeaders as Record<string, string>)['Content-Type']
    }

    return fetch(`${API_URL}${path}`, {
      ...restOptions,
      headers: mergedHeaders
    })
  }

  /**
   * GET request helper
   */
  async function get<T>(path: string): Promise<T> {
    const response = await apiFetch(path)
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }))
      throw new Error(error.error || 'Request failed')
    }
    return response.json()
  }

  /**
   * POST request helper
   */
  async function post<T>(path: string, body?: unknown): Promise<T> {
    const response = await apiFetch(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined
    })
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }))
      throw new Error(error.error || 'Request failed')
    }
    return response.json()
  }

  /**
   * PUT request helper
   */
  async function put<T>(path: string, body?: unknown): Promise<T> {
    const response = await apiFetch(path, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined
    })
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }))
      throw new Error(error.error || 'Request failed')
    }
    return response.json()
  }

  /**
   * PATCH request helper
   */
  async function patch<T>(path: string, body?: unknown): Promise<T> {
    const response = await apiFetch(path, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined
    })
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }))
      throw new Error(error.error || 'Request failed')
    }
    return response.json()
  }

  /**
   * DELETE request helper
   */
  async function del<T>(path: string): Promise<T> {
    const response = await apiFetch(path, {
      method: 'DELETE'
    })
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }))
      throw new Error(error.error || 'Request failed')
    }
    return response.json()
  }

  return {
    API_URL,
    getHeaders,
    apiFetch,
    get,
    post,
    put,
    patch,
    del
  }
}
