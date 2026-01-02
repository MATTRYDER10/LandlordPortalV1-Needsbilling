import axios from 'axios'

const SESSION_STORAGE_KEY = 'adminCompanyOverride'

// Add request interceptor to include admin company override header
axios.interceptors.request.use((config) => {
  try {
    const stored = sessionStorage.getItem(SESSION_STORAGE_KEY)
    if (stored) {
      const data = JSON.parse(stored)
      if (data.id) {
        config.headers['X-Admin-Company-Id'] = data.id
      }
    }
  } catch (e) {
    // Ignore errors reading from sessionStorage
  }
  return config
})

export default axios
