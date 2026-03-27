/**
 * Authenticated fetch wrapper that includes branch isolation headers
 * Use this instead of raw fetch() for API calls to ensure proper multi-branch isolation
 */

const SESSION_STORAGE_KEY = 'adminCompanyOverride'
const ACTIVE_BRANCH_KEY = 'activeBranchId'

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
 * Wrapper around fetch that automatically includes auth and branch headers
 */
export async function authFetch(
  url: string,
  options: RequestInit & { token?: string } = {}
): Promise<Response> {
  const { token, headers: customHeaders, ...restOptions } = options

  const authHeaders = getAuthHeaders(token)

  const mergedHeaders: Record<string, string> = {
    ...authHeaders,
    ...(customHeaders as Record<string, string> || {})
  }

  // Auto-add Content-Type for JSON bodies
  if (restOptions.body && typeof restOptions.body === 'string' && !mergedHeaders['Content-Type']) {
    mergedHeaders['Content-Type'] = 'application/json'
  }

  // Debug logging
  const activeBranchId = localStorage.getItem(ACTIVE_BRANCH_KEY)
  console.log('[authFetch]', url.split('/api/')[1]?.split('?')[0], {
    activeBranchId,
    'X-Branch-Id': mergedHeaders['X-Branch-Id']
  })

  return fetch(url, {
    ...restOptions,
    headers: mergedHeaders
  })
}

export default authFetch
