const PROD_FRONTEND_URL = 'https://app.propertygoose.co.uk'

/**
 * Check if a hostname is a local/private address that should never be used in production emails.
 * Matches: localhost, 127.x.x.x, 192.168.x.x, 10.x.x.x, 172.16-31.x.x, and ports like :5173
 */
const isLocalOrPrivateHost = (hostname: string): boolean => {
  // Direct localhost checks
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return true
  }

  // Private IP ranges (RFC 1918)
  // 10.0.0.0 - 10.255.255.255
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    return true
  }

  // 172.16.0.0 - 172.31.255.255
  if (/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    return true
  }

  // 192.168.0.0 - 192.168.255.255
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    return true
  }

  // 127.x.x.x loopback range
  if (/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    return true
  }

  return false
}

export const getFrontendUrl = (): string => {
  // ALWAYS return production URL in production environment
  // This prevents any accidental local URLs from being sent in emails
  if (process.env.NODE_ENV === 'production') {
    return PROD_FRONTEND_URL
  }

  // In development, only use local URLs if explicitly enabled
  if (process.env.USE_LOCAL_EMAIL_LINKS === 'true' && process.env.NODE_ENV !== 'production') {
    console.log('[getFrontendUrl] Using LOCAL URLs for email links (USE_LOCAL_EMAIL_LINKS=true, non-production)')
    return process.env.LOCAL_FRONTEND_URL || 'http://localhost:5173'
  }

  const rawUrl = process.env.FRONTEND_URL
  if (!rawUrl) {
    return PROD_FRONTEND_URL
  }

  try {
    const parsed = new URL(rawUrl)
    if (isLocalOrPrivateHost(parsed.hostname)) {
      console.warn(`[getFrontendUrl] Blocked local/private URL "${rawUrl}", using production URL`)
      return PROD_FRONTEND_URL
    }
    return rawUrl
  } catch {
    return PROD_FRONTEND_URL
  }
}
