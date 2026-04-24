import { useAuthStore } from '@/stores/auth'

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

    return url.toString()
  }

  /**
   * Safari-safe file download (forces download via browser navigation)
   */
  function downloadFile(path: string, filename?: string): void {
    const url = buildDownloadUrl(path, { forceDownload: true })

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
   */
  function openInNewTab(path: string): void {
    const url = buildDownloadUrl(path, { forceDownload: false })
    window.open(url, '_blank', 'noopener')
  }

  /**
   * For preview modals - still needs blob for image src
   */
  async function fetchAsBlob(path: string): Promise<string> {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Authentication required')

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`
    }

    const response = await fetch(`${API_URL}${path}`, { headers })

    if (!response.ok) throw new Error('Failed to fetch file')

    const blob = await response.blob()
    return URL.createObjectURL(blob)
  }

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
