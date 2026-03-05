/**
 * Get the API base URL.
 * In dev mode, uses the current hostname (supports local network access).
 * In production, uses VITE_API_URL environment variable.
 */
export const API_URL = import.meta.env.DEV
  ? `http://${window.location.hostname}:3001`
  : (import.meta.env.VITE_API_URL || 'http://localhost:3001')
