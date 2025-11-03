import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const session = ref<Session | null>(null)
  const company = ref<{ name: string, role: string } | null>(null)
  const onboardingCompleted = ref<boolean>(true) // Default to true to avoid flashing
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Fetch company data and onboarding status
  const fetchCompany = async () => {
    try {
      const token = session.value?.access_token
      if (!token) return

      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
      const response = await fetch(`${API_URL}/api/company`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        if (data.company && data.role) {
          company.value = { name: data.company.name, role: data.role }
        }
      } else if (response.status === 404) {
        // User is not associated with any company (likely removed from team)
        // Log them out automatically
        console.log('User no longer associated with a company, logging out...')
        await signOut()
        window.location.href = '/login'
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

      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
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

  // Fetch user data (includes onboarding check)
  const fetchUser = async () => {
    await fetchCompany()
    await fetchOnboardingStatus()
  }

  // Initialize auth state
  const initialize = async () => {
    loading.value = true
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      session.value = currentSession
      user.value = currentSession?.user ?? null

      // Fetch company data and onboarding status if user is logged in
      if (currentSession?.user) {
        await fetchCompany()
        await fetchOnboardingStatus()
      }

      // Listen for auth changes
      supabase.auth.onAuthStateChange(async (_event, newSession) => {
        session.value = newSession
        user.value = newSession?.user ?? null

        // Fetch company data and onboarding status when user signs in
        if (newSession?.user) {
          await fetchCompany()
          await fetchOnboardingStatus()
        } else {
          company.value = null
          onboardingCompleted.value = true
        }
      })
    } catch (err: any) {
      error.value = err.message
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

  // Sign out
  const signOut = async () => {
    loading.value = true
    error.value = null
    try {
      const { error: signOutError } = await supabase.auth.signOut()
      if (signOutError) throw signOutError

      user.value = null
      session.value = null
    } catch (err: any) {
      error.value = err.message
    } finally {
      loading.value = false
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
    loading,
    error,
    initialize,
    signUp,
    signIn,
    signOut,
    resetPassword,
    updatePassword,
    fetchCompany,
    fetchOnboardingStatus,
    fetchUser
  }
})
