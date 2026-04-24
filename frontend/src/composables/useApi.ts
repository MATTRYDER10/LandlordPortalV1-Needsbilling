import { useAuthStore } from '@/stores/auth'

// In dev mode, determine the correct API URL based on the access method
const getApiUrl = () => {
  if (!import.meta.env.DEV) {
    return import.meta.env.VITE_API_URL ?? ''
  }

  const hostname = window.location.hostname

  // If accessed via ngrok or other tunnels, use localhost for API
  if (hostname.includes('ngrok') || hostname.includes('loca.lt') || hostname.includes('.dev')) {
    return import.meta.env.VITE_API_URL ?? ''
  }

  // For local network access (e.g., 192.168.1.81), use the same IP
  return `http://${hostname}:3001`
}

const API_URL = getApiUrl()

/**
 * Composable for making API calls with automatic authentication.
 */
export function useApi() {
  const authStore = useAuthStore()

  function getHeaders(additionalHeaders?: Record<string, string>): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...additionalHeaders
    }

    const token = authStore.session?.access_token
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    return headers
  }

  async function apiFetch(
    path: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const { headers: customHeaders, ...restOptions } = options

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

  async function get<T>(path: string): Promise<T> {
    const response = await apiFetch(path)
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }))
      throw new Error(error.error || 'Request failed')
    }
    return response.json()
  }

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
