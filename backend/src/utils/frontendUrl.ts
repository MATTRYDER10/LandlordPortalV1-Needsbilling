const PROD_FRONTEND_URL = 'https://app.propertygoose.co.uk'

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1'])

export const getFrontendUrl = (): string => {
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
