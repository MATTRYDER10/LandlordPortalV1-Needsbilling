import { useAuthStore } from '@/stores/auth'
import { useAdminCompanyStore } from '@/stores/adminCompany'

const API_URL = import.meta.env.VITE_API_URL ?? ''

/**
 * Composable for Safari-safe file downloads.
 *
 * Safari blocks downloads triggered from async callbacks. This composable
 * provides methods that use direct URL navigation with query parameter
 * authentication instead of blob URLs.
 */
export function useDownload() {
  const authStore = useAuthStore()
  const adminCompanyStore = useAdminCompanyStore()

  /**
   * Build a Safari-safe download URL with token in query params
   */
  function buildDownloadUrl(path: string, options?: {
    forceDownload?: boolean
  }): string {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Authentication required')

    const url = new URL(`${API_URL}${path}`)
    url.searchParams.set('token', token)

    if (options?.forceDownload) {
      url.searchParams.set('download', 'true')
    }

    // Include admin company override if active
    if (adminCompanyStore.isOverrideActive && adminCompanyStore.selectedCompanyId) {
      url.searchParams.set('adminCompanyId', adminCompanyStore.selectedCompanyId)
    }

    return url.toString()
  }

  /**
   * Safari-safe file download (forces download via browser navigation)
   * This triggers an immediate download without async operations.
   */
  function downloadFile(path: string, filename?: string): void {
    const url = buildDownloadUrl(path, { forceDownload: true })

    // Create hidden anchor and click - this is synchronous
    const a = document.createElement('a')
    a.href = url
    a.download = filename || ''
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  /**
   * Safari-safe open in new tab
   * Opens the file in a new browser tab.
   */
  function openInNewTab(path: string): void {
    const url = buildDownloadUrl(path, { forceDownload: false })
    window.open(url, '_blank', 'noopener')
  }

  /**
   * For preview modals - still needs blob for image src
   * Use when displaying in an <img> or iframe, not for download.
   * This is async and may be blocked by Safari for downloads.
   */
  async function fetchAsBlob(path: string): Promise<string> {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Authentication required')

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`
    }

    // Include admin company override if active
    if (adminCompanyStore.isOverrideActive && adminCompanyStore.selectedCompanyId) {
      headers['X-Admin-Company-Id'] = adminCompanyStore.selectedCompanyId
    }

    const response = await fetch(`${API_URL}${path}`, { headers })

    if (!response.ok) throw new Error('Failed to fetch file')

    const blob = await response.blob()
    return URL.createObjectURL(blob)
  }

  /**
   * Get the API URL for external use
   */
  function getApiUrl(): string {
    return API_URL
  }

  return {
    buildDownloadUrl,
    downloadFile,
    openInNewTab,
    fetchAsBlob,
    getApiUrl
  }
}
