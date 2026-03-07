import axios from 'axios'

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

export default axios
