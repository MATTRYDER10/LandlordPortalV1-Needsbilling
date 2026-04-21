const PROD_FRONTEND_URL = 'https://app.propertygoose.co.uk'

/**
 * ALWAYS returns the production frontend URL.
 * Emails go to real people even when running locally — never use localhost.
 */
export const getFrontendUrl = (): string => {
  return PROD_FRONTEND_URL
}

/**
 * ALWAYS returns the production frontend URL.
 * Emails go to real people even when running locally — never use localhost.
 */
export const getV2FrontendUrl = (): string => {
  return PROD_FRONTEND_URL
}
