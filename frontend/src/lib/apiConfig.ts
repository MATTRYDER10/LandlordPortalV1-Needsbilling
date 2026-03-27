/**
 * Central API URL configuration
 * When running through ngrok (HTTPS), use empty string so requests go through Vite proxy
 * When running locally, use localhost:3001 directly
 */
const raw = import.meta.env.VITE_API_URL || ''

// If the URL contains 'ngrok' or is explicitly empty, use empty string for proxy
export const API_URL = (raw === '' || raw.includes('ngrok') || raw === 'USE_PROXY') ? '' : raw

export default API_URL
