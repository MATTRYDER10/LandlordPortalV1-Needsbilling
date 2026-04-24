import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '../lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

const API_URL = import.meta.env.VITE_API_URL ?? ''

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const session = ref<Session | null>(null)
  const company = ref<{ name: string, role: string, jmiEnabled?: boolean } | null>(null)
  const onboardingCompleted = ref<boolean>(true) // Default to true to avoid flashing
  const hasSubscription = ref<boolean>(false) // Tenancies subscription status
  const referenceCredits = ref<number>(0) // Pre-purchased reference credits
  const amlStatus = ref<string>('pending') // AML verification status
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Computed helpers
  const userName = computed(() => {
    const meta = user.value?.user_metadata
    return meta?.full_name || meta?.company_name || user.value?.email?.split('@')[0] || 'Landlord'
  })

  // Fetch company data
  const fetchCompany = async () => {
    try {
      const token = session.value?.access_token
      if (!token) return

      const response = await fetch(`${API_URL}/api/company`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        if (data.company && data.role) {
          company.value = {
            name: data.company.name,
            role: data.role,
            jmiEnabled: data.company.jmi_enabled !== false
          }
        }
      } else if (response.status === 403) {
        const data = await response.json().catch(() => ({}))
        if (data.error === 'Invalid token') {
          await signOut()
          if (window.location.pathname !== '/login') {
            window.location.href = '/login'
          }
        }
      } else if (response.status === 404) {
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
        onboardingCompleted.value = true
      }
    } catch (err) {
      console.error('Failed to fetch onboarding status:', err)
      onboardingCompleted.value = true
    }
  }

  // Fetch subscription status
  const fetchSubscriptionStatus = async () => {
    try {
      const token = session.value?.access_token
      if (!token) return

      const response = await fetch(`${API_URL}/api/billing/subscriptions/active`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        hasSubscription.value = data.status === 'active' || data.status === 'trialing'
      } else {
        hasSubscription.value = false
      }
    } catch (err) {
      console.error('Failed to fetch subscription status:', err)
      hasSubscription.value = false
    }
  }

  // Fetch reference credit balance
  const fetchReferenceCredits = async () => {
    try {
      const token = session.value?.access_token
      if (!token) return

      const response = await fetch(`${API_URL}/api/billing/reference-credits`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        referenceCredits.value = data.credits || 0
      } else {
        referenceCredits.value = 0
      }
    } catch (err) {
      console.error('Failed to fetch reference credits:', err)
      referenceCredits.value = 0
    }
  }

  // Fetch user data (includes onboarding check and subscription status)
  const fetchUser = async () => {
    await fetchCompany()
    await fetchOnboardingStatus()
    await fetchSubscriptionStatus()
    await fetchReferenceCredits()
  }

  // Initialize auth state
  const initialize = async () => {
    loading.value = true
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      session.value = currentSession
      user.value = currentSession?.user ?? null

      if (currentSession?.user) {
        await fetchCompany()
        await fetchOnboardingStatus()
        await fetchSubscriptionStatus()
        await fetchReferenceCredits()
      }

      // Listen for auth changes
      supabase.auth.onAuthStateChange(async (_event, newSession) => {
        session.value = newSession
        user.value = newSession?.user ?? null

        if (newSession?.user) {
          await fetchCompany()
          await fetchOnboardingStatus()
          await fetchSubscriptionStatus()
          await fetchReferenceCredits()
        } else {
          company.value = null
          onboardingCompleted.value = true
          hasSubscription.value = false
          referenceCredits.value = 0
        }
      })
    } catch (err: any) {
      error.value = err.message
      if (err.message?.includes('Refresh Token') || err.name === 'AuthApiError') {
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

  // Sign out
  const signOut = async () => {
    loading.value = true
    error.value = null
    try {
      await supabase.auth.signOut()
    } catch (err: any) {
      console.error('Supabase signOut error:', err.message)
    } finally {
      user.value = null
      session.value = null
      company.value = null
      onboardingCompleted.value = true
      hasSubscription.value = false
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
    hasSubscription,
    referenceCredits,
    amlStatus,
    loading,
    error,
    userName,
    // Auth
    initialize,
    signUp,
    signIn,
    signOut,
    resetPassword,
    updatePassword,
    fetchCompany,
    fetchOnboardingStatus,
    fetchSubscriptionStatus,
    fetchReferenceCredits,
    fetchUser
  }
})
