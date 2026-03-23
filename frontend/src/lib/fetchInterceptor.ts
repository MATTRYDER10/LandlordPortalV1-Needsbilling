/**
 * Global fetch interceptor that injects admin company override header
 * on all API requests when admin is viewing as another company.
 *
 * This ensures ALL fetch() calls (not just authFetch) include the header.
 */

const SESSION_STORAGE_KEY = 'adminCompanyOverride'
const API_URL = import.meta.env.VITE_API_URL ?? ''

const originalFetch = window.fetch.bind(window)

window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  // Only intercept API calls (not external URLs, assets, etc.)
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url
  const isApiCall = url.includes('/api/') || (API_URL && url.startsWith(API_URL))

  if (isApiCall) {
    try {
      const stored = sessionStorage.getItem(SESSION_STORAGE_KEY)
      if (stored) {
        const data = JSON.parse(stored)
        if (data.id && (!data.expiresAt || Date.now() <= data.expiresAt)) {
          // Inject admin override header
          const headers = new Headers(init?.headers || {})
          if (!headers.has('X-Admin-Company-Id')) {
            headers.set('X-Admin-Company-Id', data.id)
          }
          init = { ...init, headers }
        }
      }
    } catch (e) {
      // Ignore errors
    }
  }

  return originalFetch(input, init)
}

export {} // Make this a module
