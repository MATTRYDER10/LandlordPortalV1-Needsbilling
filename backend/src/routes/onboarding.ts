import { Router } from 'express'
import { authenticateToken, AuthRequest } from '../middleware/auth'
import { supabase } from '../config/supabase'
import { createAuditLog } from '../services/auditLog'
import { sendEmail, loadEmailTemplate } from '../services/emailService'

const router = Router()

// Get onboarding status
router.get('/status', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id

    // Get user's company
    const { data: companyUser, error: companyUserError } = await supabase
      .from('company_users')
      .select('company_id, role')
      .eq('user_id', userId!)
      .single()

    if (companyUserError || !companyUser) {
      return res.status(404).json({ error: 'Company not found' })
    }

    // Get company onboarding status
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('onboarding_completed, onboarding_step')
      .eq('id', companyUser.company_id)
      .single()

    if (companyError || !company) {
      return res.status(404).json({ error: 'Company not found' })
    }

    // Check if user is invited (should skip onboarding)
    const { data: { user } } = await supabase.auth.admin.getUserById(userId!)
    const isInvited = user?.user_metadata?.is_invited === true

    res.json({
      onboardingCompleted: company.onboarding_completed || isInvited,
      currentStep: company.onboarding_step || 0,
      shouldSkipOnboarding: isInvited,
      role: companyUser.role
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Update onboarding step (save progress)
router.put('/step', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    const { step } = req.body

    if (typeof step !== 'number' || step < 0 || step > 5) {
      return res.status(400).json({ error: 'Invalid step number. Must be between 0 and 5.' })
    }

    // Get user's company
    const { data: companyUser, error: companyUserError } = await supabase
      .from('company_users')
      .select('company_id, role')
      .eq('user_id', userId!)
      .single()

    if (companyUserError || !companyUser) {
      return res.status(404).json({ error: 'Company not found' })
    }

    // Only owner/admin can update onboarding
    if (companyUser.role !== 'owner' && companyUser.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' })
    }

    // Update onboarding step
    const { error: updateError } = await supabase
      .from('companies')
      .update({
        onboarding_step: step,
        updated_at: new Date().toISOString()
      })
      .eq('id', companyUser.company_id)

    if (updateError) {
      return res.status(400).json({ error: updateError.message })
    }

    res.json({
      message: 'Onboarding progress saved',
      step
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Complete onboarding
router.post('/complete', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id

    // Get user's company
    const { data: companyUser, error: companyUserError } = await supabase
      .from('company_users')
      .select('company_id, role')
      .eq('user_id', userId!)
      .single()

    if (companyUserError || !companyUser) {
      return res.status(404).json({ error: 'Company not found' })
    }

    // Only owner/admin can complete onboarding
    if (companyUser.role !== 'owner' && companyUser.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' })
    }

    // Validate that required information is present
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('name_encrypted, address_encrypted, city_encrypted, postcode_encrypted, phone_encrypted, stripe_payment_method_id, onboarding_completed')
      .eq('id', companyUser.company_id)
      .single()

    if (companyError || !company) {
      console.error('Company fetch error:', companyError)
      return res.status(404).json({ error: 'Company not found' })
    }

    // Idempotency check: if onboarding is already completed, return success without re-processing
    // This prevents duplicate emails and audit logs when the endpoint is called multiple times
    if (company.onboarding_completed) {
      console.log('Onboarding already completed for company:', companyUser.company_id)
      return res.json({
        message: 'Onboarding already completed',
        onboardingCompleted: true
      })
    }

    // Log company data for debugging
    console.log('Company data during onboarding validation:', {
      has_name: !!company.name_encrypted,
      has_address: !!company.address_encrypted,
      has_city: !!company.city_encrypted,
      has_postcode: !!company.postcode_encrypted,
      has_phone: !!company.phone_encrypted,
      has_payment_method: !!company.stripe_payment_method_id
    })

    // Check required fields
    const missingFields = []
    if (!company.name_encrypted) missingFields.push('company name')
    if (!company.address_encrypted) missingFields.push('address')
    if (!company.city_encrypted) missingFields.push('city')
    if (!company.postcode_encrypted) missingFields.push('postcode')
    if (!company.phone_encrypted) missingFields.push('phone')
    if (!company.stripe_payment_method_id) missingFields.push('payment method')

    if (missingFields.length > 0) {
      return res.status(400).json({
        error: 'Cannot complete onboarding. Missing required fields.',
        missingFields
      })
    }

    // Check user profile has required fields
    const { data: { user } } = await supabase.auth.admin.getUserById(userId!)
    if (!user?.user_metadata?.full_name) {
      return res.status(400).json({
        error: 'Cannot complete onboarding. Missing full name in profile.',
        missingFields: ['full name']
      })
    }

    // Mark onboarding as complete
    const { error: updateError } = await supabase
      .from('companies')
      .update({
        onboarding_completed: true,
        onboarding_step: 5,
        onboarding_completed_at: new Date().toISOString(),
        payment_method_required: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', companyUser.company_id)

    if (updateError) {
      return res.status(400).json({ error: updateError.message })
    }

    // Create audit log
    await createAuditLog(
      {
        companyId: companyUser.company_id,
        userId: userId!,
        actionType: 'company.onboarding_completed',
        resourceType: 'company',
        resourceId: companyUser.company_id,
        description: 'Completed onboarding wizard',
        metadata: { completedAt: new Date().toISOString() }
      },
      req
    )

    // Send welcome email
    try {
      const emailHtml = loadEmailTemplate('onboarding-welcome', {
        FullName: user?.user_metadata?.full_name || 'there'
      })

      await sendEmail({
        to: user?.email || '',
        subject: 'Welcome to PropertyGoose - Setup Complete!',
        html: emailHtml
      })
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError)
      // Don't fail the onboarding if email fails
    }

    res.json({
      message: 'Onboarding completed successfully',
      onboardingCompleted: true
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

export default router
