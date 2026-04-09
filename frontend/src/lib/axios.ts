import axios from 'axios'
import { refreshAndGetToken } from './authFetch'

const SESSION_STORAGE_KEY = 'adminCompanyOverride'
const ACTIVE_BRANCH_KEY = 'activeBranchId'

// Add request interceptor to include admin company override header AND branch isolation header
axios.interceptors.request.use((config) => {
  try {
    // First, check for admin company override (takes priority)
    const stored = sessionStorage.getItem(SESSION_STORAGE_KEY)
    if (stored) {
      const data = JSON.parse(stored)
      if (data.id) {
        config.headers['X-Admin-Company-Id'] = data.id
        // Don't add branch header when admin override is active
        return config
      }
    }

    // If no admin override, add branch isolation header for multi-branch users
    const activeBranchId = localStorage.getItem(ACTIVE_BRANCH_KEY)
    if (activeBranchId) {
      config.headers['X-Branch-Id'] = activeBranchId
    }
  } catch (e) {
    // Ignore errors reading from storage
  }
  return config
})

// Handle expired/invalid tokens globally -- refresh + retry on 403 "Invalid token"
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config
    if (
      error.response?.status === 403 &&
      error.response?.data?.error === 'Invalid token' &&
      !config._retried
    ) {
      config._retried = true
      const newToken = await refreshAndGetToken()
      if (newToken) {
        config.headers['Authorization'] = `Bearer ${newToken}`
        return axios(config)
      }
      if (window.location.pathname !== '/login' && window.location.pathname !== '/staff/login') {
        window.location.href = '/login'
      }
      // Resolve instead of reject to avoid UnhandledRejection
      return Promise.resolve({ data: null, status: 403, _authRedirected: true })
    }
    return Promise.reject(error)
  }
)

export default axios
