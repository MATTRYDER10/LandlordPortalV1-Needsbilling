import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '../lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

const API_URL = import.meta.env.VITE_API_URL ?? ''

export interface Branch {
  id: string
  name: string
  role: string
  logoUrl?: string
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const session = ref<Session | null>(null)
  const company = ref<{ name: string, role: string, logoUrl?: string, jmiEnabled?: boolean, rentgooseEnabled?: boolean } | null>(null)
  const onboardingCompleted = ref<boolean>(true) // Default to true to avoid flashing
  const isAdmin = ref<boolean>(false) // Admin staff privileges
  const isStaff = ref<boolean>(false) // Staff portal access
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Multi-branch support — activeBranchId is in-memory only, derived from DB on each login
  const branches = ref<Branch[]>([])
  const activeBranchId = ref<string | null>(null)
  const hasMultipleBranches = computed(() => branches.value.length > 1)

  // Fetch all branches for the user from the database
  const fetchBranches = async () => {
    try {
      const token = session.value?.access_token
      if (!token) return

      const response = await fetch(`${API_URL}/api/company/branches`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        branches.value = data.branches || []

        // If current activeBranchId doesn't match any branch, clear it
        if (activeBranchId.value && !branches.value.find(b => b.id === activeBranchId.value)) {
          activeBranchId.value = null
        }

        // Single branch: auto-select it immediately
        if (branches.value.length === 1 && !activeBranchId.value) {
          setActiveBranch(branches.value[0]!.id)
        }
        // Multiple branches with no selection: leave null — router guard will redirect to branch selector
      }
    } catch (err) {
      console.error('Failed to fetch branches:', err)
    }
  }

  // Set the active branch (called from BranchSelector or auto-select)
  const setActiveBranch = (branchId: string) => {
    activeBranchId.value = branchId
    // Mirror to localStorage for components that read it directly via fetch headers
    localStorage.setItem('activeBranchId', branchId)

    // Update the company ref with the active branch details
    const branch = branches.value.find(b => b.id === branchId)
    if (branch) {
      company.value = {
        name: branch.name,
        role: branch.role,
        logoUrl: branch.logoUrl
      }
    }
  }

  // Clear the active branch (for switching)
  const clearActiveBranch = () => {
    activeBranchId.value = null
    localStorage.removeItem('activeBranchId')
  }

  // Fetch company data and onboarding status
  const fetchCompany = async () => {
    try {
      const token = session.value?.access_token
      if (!token) return

      const headers: Record<string, string> = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }

      // Include active branch ID if set (from in-memory state, not localStorage)
      if (activeBranchId.value) {
        headers['X-Branch-Id'] = activeBranchId.value
      }

      const response = await fetch(`${API_URL}/api/company`, {
        headers
      })

      if (response.ok) {
        const data = await response.json()
        if (data.company && data.role) {
          company.value = { name: data.company.name, role: data.role, logoUrl: data.company.logo_url || undefined, jmiEnabled: data.company.jmi_enabled !== false, rentgooseEnabled: data.company.rentgoose_enabled === true }
        }
      } else if (response.status === 403) {
        // Check if token is invalid (not just permission denied)
        const data = await response.json().catch(() => ({}))
        if (data.error === 'Invalid token') {
          console.log('Invalid token detected, forcing logout...')
          await signOut()
          if (window.location.pathname !== '/login') {
            window.location.href = '/login'
          }
        }
      } else if (response.status === 404) {
        // User is not associated with any company (likely removed from team)
        // Log them out automatically
        console.log('User no longer associated with a company, logging out...')
        await signOut()
        if (window.location.pathname !== '/login') {
          window.location.href = '/login'
        }
      }
    } catch (err) {
      console.error('Failed to fetch company:', err)
    }
  }

  // Fetch onboarding status
  const fetchOnboardingStatus = async () => {
    try {
      const token = session.value?.access_token
      if (!token) return

      
      const response = await fetch(`${API_URL}/api/onboarding/status`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        onboardingCompleted.value = data.onboardingCompleted || data.shouldSkipOnboarding
      } else {
        // Default to true if error (prevents redirect loop)
        onboardingCompleted.value = true
      }
    } catch (err) {
      console.error('Failed to fetch onboarding status:', err)
      onboardingCompleted.value = true
    }
  }

  // Check if user has admin privileges
  const fetchAdminStatus = async () => {
    try {
      const token = session.value?.access_token
      if (!token) {
        isAdmin.value = false
        return
      }

      
      const response = await fetch(`${API_URL}/api/profile/check-admin`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        isAdmin.value = data.isAdmin === true
      } else {
        isAdmin.value = false
      }
    } catch (err) {
      console.error('Failed to fetch admin status:', err)
      isAdmin.value = false
    }
  }

  // Check if user has staff privileges
  const fetchStaffStatus = async () => {
    try {
      const token = session.value?.access_token
      if (!token) {
        isStaff.value = false
        return
      }

      
      const response = await fetch(`${API_URL}/api/profile/check-staff`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        isStaff.value = data.isStaff === true
      } else {
        isStaff.value = false
      }
    } catch (err) {
      console.error('Failed to fetch staff status:', err)
      isStaff.value = false
    }
  }

  // Fetch user data (includes onboarding check, staff status, and admin status)
  const fetchUser = async () => {
    await fetchCompany()
    await fetchOnboardingStatus()
    await fetchStaffStatus()
    if (isStaff.value) {
      await fetchAdminStatus()
    } else {
      isAdmin.value = false
    }
  }

  // Initialize auth state
  const initialize = async () => {
    loading.value = true
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      session.value = currentSession
      user.value = currentSession?.user ?? null

      // Fetch company data, onboarding status, staff status, and admin status if user is logged in
      if (currentSession?.user) {
        await fetchBranches()
        await fetchCompany()
        await fetchOnboardingStatus()
        await fetchStaffStatus()
        if (isStaff.value) {
          await fetchAdminStatus()
        } else {
          isAdmin.value = false
        }
      }

      // Listen for auth changes
      supabase.auth.onAuthStateChange(async (_event, newSession) => {
        session.value = newSession
        user.value = newSession?.user ?? null

        // Fetch company data, onboarding status, staff status, and admin status when user signs in
        if (newSession?.user) {
          await fetchBranches()
          await fetchCompany()
          await fetchOnboardingStatus()
          await fetchStaffStatus()
          if (isStaff.value) {
            await fetchAdminStatus()
          } else {
            isAdmin.value = false
          }
        } else {
          company.value = null
          onboardingCompleted.value = true
          isStaff.value = false
          isAdmin.value = false
          branches.value = []
          activeBranchId.value = null
          localStorage.removeItem('activeBranchId')
        }
      })
    } catch (err: any) {
      error.value = err.message
      // If we get an invalid refresh token error, clear the stale auth data
      if (err.message?.includes('Refresh Token') || err.name === 'AuthApiError') {
        console.log('Invalid refresh token detected, clearing auth state...')
        await supabase.auth.signOut()
        session.value = null
        user.value = null
        company.value = null
      }
    } finally {
      loading.value = false
    }
  }

  // Sign up
  const signUp = async (email: string, password: string, metadata: { company_name: string }) => {
    loading.value = true
    error.value = null
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata
        }
      })

      if (signUpError) throw signUpError

      return { data, error: null }
    } catch (err: any) {
      error.value = err.message
      return { data: null, error: err.message }
    } finally {
      loading.value = false
    }
  }

  // Sign in
  const signIn = async (email: string, password: string) => {
    loading.value = true
    error.value = null
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (signInError) throw signInError

      return { data, error: null }
    } catch (err: any) {
      error.value = err.message
      return { data: null, error: err.message }
    } finally {
      loading.value = false
    }
  }

  // Sign out - always clears local state even if Supabase signOut fails
  const signOut = async () => {
    loading.value = true
    error.value = null
    try {
      await supabase.auth.signOut()
    } catch (err: any) {
      // Log but don't block - we still want to clear local state
      console.error('Supabase signOut error:', err.message)
    } finally {
      // ALWAYS clear local state, even if Supabase fails
      user.value = null
      session.value = null
      company.value = null
      onboardingCompleted.value = true
      isStaff.value = false
      isAdmin.value = false
      loading.value = false
      branches.value = []
      activeBranchId.value = null
      localStorage.removeItem('activeBranchId')
      // Clear admin company override from sessionStorage
      sessionStorage.removeItem('adminCompanyOverride')
    }
  }

  // Reset password
  const resetPassword = async (email: string) => {
    loading.value = true
    error.value = null
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (resetError) throw resetError

      return { error: null }
    } catch (err: any) {
      error.value = err.message
      return { error: err.message }
    } finally {
      loading.value = false
    }
  }

  // Update password
  const updatePassword = async (newPassword: string) => {
    loading.value = true
    error.value = null
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (updateError) throw updateError

      return { error: null }
    } catch (err: any) {
      error.value = err.message
      return { error: err.message }
    } finally {
      loading.value = false
    }
  }

  return {
    user,
    session,
    company,
    onboardingCompleted,
    isStaff,
    isAdmin,
    loading,
    error,
    // Multi-branch
    branches,
    activeBranchId,
    hasMultipleBranches,
    fetchBranches,
    setActiveBranch,
    clearActiveBranch,
    // Auth
    initialize,
    signUp,
    signIn,
    signOut,
    resetPassword,
    updatePassword,
    fetchCompany,
    fetchOnboardingStatus,
    fetchStaffStatus,
    fetchAdminStatus,
    fetchUser
  }
})
