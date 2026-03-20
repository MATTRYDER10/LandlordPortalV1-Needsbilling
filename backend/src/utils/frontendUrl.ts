const PROD_FRONTEND_URL = 'https://app.propertygoose.co.uk'
// Use LAN IP for local testing from other devices
const LOCAL_FRONTEND_URL = 'http://192.168.1.190:5174'
const LOCALHOST_URL = 'http://localhost:5173'

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1'])

export const getFrontendUrl = (): string => {
  // Check at runtime (not module load time) so dotenv has loaded
  // Set USE_LOCAL_EMAIL_LINKS=true in .env to use localhost URLs in emails for testing
  if (process.env.USE_LOCAL_EMAIL_LINKS === 'true') {
    console.log('[getFrontendUrl] Using LOCAL URLs for email links (USE_LOCAL_EMAIL_LINKS=true)')
    return LOCAL_FRONTEND_URL
  }

  const rawUrl = process.env.FRONTEND_URL
  if (!rawUrl) {
    return PROD_FRONTEND_URL
  }

  try {
    const parsed = new URL(rawUrl)
    if (LOCAL_HOSTNAMES.has(parsed.hostname)) {
      return PROD_FRONTEND_URL
    }
    return rawUrl
  } catch {
    return PROD_FRONTEND_URL
  }
}

/**
 * Get frontend URL for V2 features during development.
 * Uses localhost in development mode, production URL otherwise.
 * This allows testing V2 features locally without affecting V1.
 */
export const getV2FrontendUrl = (): string => {
  // In production, always use production URL
  if (process.env.NODE_ENV === 'production') {
    return PROD_FRONTEND_URL
  }

  // In development, use localhost for V2 testing
  return LOCALHOST_URL
}
