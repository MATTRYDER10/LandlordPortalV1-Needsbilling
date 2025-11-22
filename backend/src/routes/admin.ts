import express from 'express'
import { supabase } from '../config/supabase'
import { authenticateAdmin, AdminAuthRequest } from '../middleware/adminAuth'

const router = express.Router()

/**
 * GET /api/admin/statistics/references
 * Get reference submission and completion statistics
 * Query params: date (optional, defaults to today)
 */
router.get('/statistics/references', authenticateAdmin, async (req: AdminAuthRequest, res) => {
  try {
    const { date } = req.query

    let startDate: Date
    let endDate: Date

    if (date === 'yesterday') {
      startDate = new Date()
      startDate.setDate(startDate.getDate() - 1)
      startDate.setHours(0, 0, 0, 0)
      endDate = new Date()
      endDate.setDate(endDate.getDate() - 1)
      endDate.setHours(23, 59, 59, 999)
    } else if (date && date !== 'today') {
      // Custom date provided
      startDate = new Date(date as string)
      startDate.setHours(0, 0, 0, 0)
      endDate = new Date(date as string)
      endDate.setHours(23, 59, 59, 999)
    } else {
      // Default to today
      startDate = new Date()
      startDate.setHours(0, 0, 0, 0)
      endDate = new Date()
      endDate.setHours(23, 59, 59, 999)
    }

    // Get references submitted in the date range
    const { data: submittedRefs, error: submittedError } = await supabase
      .from('tenant_references')
      .select('id', { count: 'exact' })
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())

    if (submittedError) {
      throw submittedError
    }

    // Get references completed in the date range (status = 'completed')
    const { data: completedRefs, error: completedError, count: completedCount } = await supabase
      .from('tenant_references')
      .select('id', { count: 'exact' })
      .eq('status', 'completed')
      .gte('updated_at', startDate.toISOString())
      .lte('updated_at', endDate.toISOString())

    if (completedError) {
      throw completedError
    }

    res.json({
      date: date || 'today',
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      statistics: {
        submitted: submittedRefs?.length || 0,
        completed: completedCount || 0
      }
    })
  } catch (error) {
    console.error('Error fetching reference statistics:', error)
    res.status(500).json({ error: 'Failed to fetch reference statistics' })
  }
})

/**
 * GET /api/admin/statistics/businesses
 * Get new business signup statistics
 * Query params: date (optional, defaults to today)
 */
router.get('/statistics/businesses', authenticateAdmin, async (req: AdminAuthRequest, res) => {
  try {
    const { date } = req.query

    let startDate: Date
    let endDate: Date

    if (date === 'yesterday') {
      startDate = new Date()
      startDate.setDate(startDate.getDate() - 1)
      startDate.setHours(0, 0, 0, 0)
      endDate = new Date()
      endDate.setDate(endDate.getDate() - 1)
      endDate.setHours(23, 59, 59, 999)
    } else if (date && date !== 'today') {
      startDate = new Date(date as string)
      startDate.setHours(0, 0, 0, 0)
      endDate = new Date(date as string)
      endDate.setHours(23, 59, 59, 999)
    } else {
      startDate = new Date()
      startDate.setHours(0, 0, 0, 0)
      endDate = new Date()
      endDate.setHours(23, 59, 59, 999)
    }

    // Get companies created in the date range
    const { data: companies, error, count } = await supabase
      .from('companies')
      .select('id', { count: 'exact' })
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())

    if (error) {
      throw error
    }

    res.json({
      date: date || 'today',
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      statistics: {
        newBusinesses: count || 0
      }
    })
  } catch (error) {
    console.error('Error fetching business statistics:', error)
    res.status(500).json({ error: 'Failed to fetch business statistics' })
  }
})

/**
 * GET /api/admin/statistics/revenue
 * Get total revenue statistics
 * Query params: date (optional, defaults to today)
 */
router.get('/statistics/revenue', authenticateAdmin, async (req: AdminAuthRequest, res) => {
  try {
    const { date } = req.query

    let startDate: Date
    let endDate: Date

    if (date === 'yesterday') {
      startDate = new Date()
      startDate.setDate(startDate.getDate() - 1)
      startDate.setHours(0, 0, 0, 0)
      endDate = new Date()
      endDate.setDate(endDate.getDate() - 1)
      endDate.setHours(23, 59, 59, 999)
    } else if (date && date !== 'today') {
      startDate = new Date(date as string)
      startDate.setHours(0, 0, 0, 0)
      endDate = new Date(date as string)
      endDate.setHours(23, 59, 59, 999)
    } else {
      startDate = new Date()
      startDate.setHours(0, 0, 0, 0)
      endDate = new Date()
      endDate.setHours(23, 59, 59, 999)
    }

    // Get revenue from credit transactions (purchases only, positive amounts)
    const { data: creditRevenue, error: creditError } = await supabase
      .from('credit_transactions')
      .select('amount_gbp')
      .in('type', ['pack_purchase', 'subscription_credit', 'auto_recharge'])
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())

    if (creditError) {
      throw creditError
    }

    // Get revenue from agreement payments
    const { data: agreementRevenue, error: agreementError } = await supabase
      .from('agreement_payments')
      .select('amount_gbp')
      .eq('payment_status', 'succeeded')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())

    if (agreementError) {
      throw agreementError
    }

    const totalCreditRevenue = creditRevenue?.reduce((sum, tx) => sum + (parseFloat(tx.amount_gbp) || 0), 0) || 0
    const totalAgreementRevenue = agreementRevenue?.reduce((sum, payment) => sum + (parseFloat(payment.amount_gbp) || 0), 0) || 0
    const totalRevenue = totalCreditRevenue + totalAgreementRevenue

    res.json({
      date: date || 'today',
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      statistics: {
        creditRevenue: totalCreditRevenue.toFixed(2),
        agreementRevenue: totalAgreementRevenue.toFixed(2),
        totalRevenue: totalRevenue.toFixed(2),
        currency: 'GBP'
      }
    })
  } catch (error) {
    console.error('Error fetching revenue statistics:', error)
    res.status(500).json({ error: 'Failed to fetch revenue statistics' })
  }
})

/**
 * GET /api/admin/companies/new
 * Get list of new companies with owner details
 * Query params: limit (optional, defaults to 50), offset (optional, defaults to 0)
 */
router.get('/companies/new', authenticateAdmin, async (req: AdminAuthRequest, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50
    const offset = parseInt(req.query.offset as string) || 0

    // Get recent companies with their owner information
    const { data: companies, error: companiesError } = await supabase
      .from('companies')
      .select(`
        id,
        name_encrypted,
        email_encrypted,
        created_at,
        onboarding_completed,
        reference_credits
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (companiesError) {
      throw companiesError
    }

    // For each company, get the owner's details
    const companiesWithOwners = await Promise.all(
      companies.map(async (company) => {
        const { data: ownerRelation, error: ownerError } = await supabase
          .from('company_users')
          .select(`
            user_id,
            role
          `)
          .eq('company_id', company.id)
          .eq('role', 'owner')
          .single()

        if (ownerError || !ownerRelation) {
          return {
            ...company,
            owner: null
          }
        }

        // Get user details from auth.users
        const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(
          ownerRelation.user_id
        )

        if (userError || !user) {
          return {
            ...company,
            owner: null
          }
        }

        return {
          id: company.id,
          companyName: company.name_encrypted,
          companyEmail: company.email_encrypted,
          createdAt: company.created_at,
          onboardingCompleted: company.onboarding_completed,
          credits: company.reference_credits,
          owner: {
            name: user.user_metadata?.full_name || 'N/A',
            email: user.email
          }
        }
      })
    )

    res.json({
      companies: companiesWithOwners,
      total: companiesWithOwners.length
    })
  } catch (error) {
    console.error('Error fetching new companies:', error)
    res.status(500).json({ error: 'Failed to fetch new companies' })
  }
})

/**
 * POST /api/admin/staff
 * Create a new PropertyGoose staff account
 * Body: { email: string, fullName: string, password: string, isAdmin: boolean }
 */
router.post('/staff', authenticateAdmin, async (req: AdminAuthRequest, res) => {
  try {
    const { email, fullName, password, isAdmin = false } = req.body

    if (!email || !fullName || !password) {
      return res.status(400).json({
        error: 'Email, full name, and password are required'
      })
    }

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName
      }
    })

    if (authError || !authData.user) {
      console.error('Error creating auth user:', authError)
      return res.status(400).json({
        error: authError?.message || 'Failed to create user account'
      })
    }

    // Create staff user record
    const { data: staffUser, error: staffError } = await supabase
      .from('staff_users')
      .insert({
        user_id: authData.user.id,
        email,
        full_name: fullName,
        is_active: true,
        is_admin: isAdmin
      })
      .select()
      .single()

    if (staffError) {
      // Rollback: delete the auth user
      await supabase.auth.admin.deleteUser(authData.user.id)
      console.error('Error creating staff user record:', staffError)
      return res.status(500).json({
        error: 'Failed to create staff user record'
      })
    }

    res.status(201).json({
      message: 'Staff account created successfully',
      staff: {
        id: staffUser.id,
        email: staffUser.email,
        fullName: staffUser.full_name,
        isAdmin: staffUser.is_admin,
        isActive: staffUser.is_active
      }
    })
  } catch (error) {
    console.error('Error creating staff account:', error)
    res.status(500).json({ error: 'Failed to create staff account' })
  }
})

/**
 * GET /api/admin/staff
 * Get list of all staff accounts
 */
router.get('/staff', authenticateAdmin, async (req: AdminAuthRequest, res) => {
  try {
    const { data: staffUsers, error } = await supabase
      .from('staff_users')
      .select('id, email, full_name, is_active, is_admin, created_at, updated_at')
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    res.json({
      staff: staffUsers
    })
  } catch (error) {
    console.error('Error fetching staff list:', error)
    res.status(500).json({ error: 'Failed to fetch staff list' })
  }
})

/**
 * PATCH /api/admin/staff/:staffId
 * Update staff account (activate/deactivate, change admin status)
 * Body: { isActive?: boolean, isAdmin?: boolean }
 */
router.patch('/staff/:staffId', authenticateAdmin, async (req: AdminAuthRequest, res) => {
  try {
    const { staffId } = req.params
    const { isActive, isAdmin } = req.body

    const updates: any = {}
    if (typeof isActive === 'boolean') {
      updates.is_active = isActive
    }
    if (typeof isAdmin === 'boolean') {
      updates.is_admin = isAdmin
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        error: 'At least one field (isActive or isAdmin) must be provided'
      })
    }

    updates.updated_at = new Date().toISOString()

    const { data: staffUser, error } = await supabase
      .from('staff_users')
      .update(updates)
      .eq('id', staffId)
      .select()
      .single()

    if (error) {
      throw error
    }

    res.json({
      message: 'Staff account updated successfully',
      staff: {
        id: staffUser.id,
        email: staffUser.email,
        fullName: staffUser.full_name,
        isActive: staffUser.is_active,
        isAdmin: staffUser.is_admin
      }
    })
  } catch (error) {
    console.error('Error updating staff account:', error)
    res.status(500).json({ error: 'Failed to update staff account' })
  }
})

/**
 * GET /api/admin/dashboard
 * Get comprehensive dashboard statistics
 */
router.get('/dashboard', authenticateAdmin, async (req: AdminAuthRequest, res) => {
  try {
    // Get today's date range
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayEnd = new Date()
    todayEnd.setHours(23, 59, 59, 999)

    // Get yesterday's date range
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    yesterday.setHours(0, 0, 0, 0)
    const yesterdayEnd = new Date()
    yesterdayEnd.setDate(yesterdayEnd.getDate() - 1)
    yesterdayEnd.setHours(23, 59, 59, 999)

    // Parallel queries for better performance
    const [
      todayRefsSubmitted,
      todayRefsCompleted,
      todayBusinesses,
      todayCreditRevenue,
      todayAgreementRevenue,
      yesterdayRefsSubmitted,
      yesterdayRefsCompleted,
      yesterdayBusinesses,
      yesterdayCreditRevenue,
      yesterdayAgreementRevenue,
      totalCompanies,
      totalReferences,
      activeStaff
    ] = await Promise.all([
      // Today's stats
      supabase.from('tenant_references').select('id', { count: 'exact' }).gte('created_at', today.toISOString()).lte('created_at', todayEnd.toISOString()),
      supabase.from('tenant_references').select('id', { count: 'exact' }).eq('status', 'completed').gte('updated_at', today.toISOString()).lte('updated_at', todayEnd.toISOString()),
      supabase.from('companies').select('id', { count: 'exact' }).gte('created_at', today.toISOString()).lte('created_at', todayEnd.toISOString()),
      supabase.from('credit_transactions').select('amount_gbp').in('type', ['pack_purchase', 'subscription_credit', 'auto_recharge']).gte('created_at', today.toISOString()).lte('created_at', todayEnd.toISOString()),
      supabase.from('agreement_payments').select('amount_gbp').eq('payment_status', 'succeeded').gte('created_at', today.toISOString()).lte('created_at', todayEnd.toISOString()),

      // Yesterday's stats
      supabase.from('tenant_references').select('id', { count: 'exact' }).gte('created_at', yesterday.toISOString()).lte('created_at', yesterdayEnd.toISOString()),
      supabase.from('tenant_references').select('id', { count: 'exact' }).eq('status', 'completed').gte('updated_at', yesterday.toISOString()).lte('updated_at', yesterdayEnd.toISOString()),
      supabase.from('companies').select('id', { count: 'exact' }).gte('created_at', yesterday.toISOString()).lte('created_at', yesterdayEnd.toISOString()),
      supabase.from('credit_transactions').select('amount_gbp').in('type', ['pack_purchase', 'subscription_credit', 'auto_recharge']).gte('created_at', yesterday.toISOString()).lte('created_at', yesterdayEnd.toISOString()),
      supabase.from('agreement_payments').select('amount_gbp').eq('payment_status', 'succeeded').gte('created_at', yesterday.toISOString()).lte('created_at', yesterdayEnd.toISOString()),

      // Overall stats
      supabase.from('companies').select('id', { count: 'exact' }),
      supabase.from('tenant_references').select('id', { count: 'exact' }),
      supabase.from('staff_users').select('id', { count: 'exact' }).eq('is_active', true)
    ])

    // Calculate revenue
    const todayTotalRevenue =
      (todayCreditRevenue.data?.reduce((sum, tx) => sum + (parseFloat(tx.amount_gbp) || 0), 0) || 0) +
      (todayAgreementRevenue.data?.reduce((sum, payment) => sum + (parseFloat(payment.amount_gbp) || 0), 0) || 0)

    const yesterdayTotalRevenue =
      (yesterdayCreditRevenue.data?.reduce((sum, tx) => sum + (parseFloat(tx.amount_gbp) || 0), 0) || 0) +
      (yesterdayAgreementRevenue.data?.reduce((sum, payment) => sum + (parseFloat(payment.amount_gbp) || 0), 0) || 0)

    res.json({
      today: {
        referencesSubmitted: todayRefsSubmitted.count || 0,
        referencesCompleted: todayRefsCompleted.count || 0,
        newBusinesses: todayBusinesses.count || 0,
        revenue: todayTotalRevenue.toFixed(2)
      },
      yesterday: {
        referencesSubmitted: yesterdayRefsSubmitted.count || 0,
        referencesCompleted: yesterdayRefsCompleted.count || 0,
        newBusinesses: yesterdayBusinesses.count || 0,
        revenue: yesterdayTotalRevenue.toFixed(2)
      },
      totals: {
        companies: totalCompanies.count || 0,
        references: totalReferences.count || 0,
        activeStaff: activeStaff.count || 0
      }
    })
  } catch (error) {
    console.error('Error fetching dashboard statistics:', error)
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' })
  }
})

/**
 * GET /api/admin/staff/performance
 * Get staff verification performance statistics (leaderboard)
 * Query params: date (optional, defaults to today)
 */
router.get('/staff/performance', authenticateAdmin, async (req: AdminAuthRequest, res) => {
  try {
    const { date } = req.query

    let startDate: Date
    let endDate: Date

    if (date === 'yesterday') {
      startDate = new Date()
      startDate.setDate(startDate.getDate() - 1)
      startDate.setHours(0, 0, 0, 0)
      endDate = new Date()
      endDate.setDate(endDate.getDate() - 1)
      endDate.setHours(23, 59, 59, 999)
    } else if (date && date !== 'today') {
      startDate = new Date(date as string)
      startDate.setHours(0, 0, 0, 0)
      endDate = new Date(date as string)
      endDate.setHours(23, 59, 59, 999)
    } else {
      startDate = new Date()
      startDate.setHours(0, 0, 0, 0)
      endDate = new Date()
      endDate.setHours(23, 59, 59, 999)
    }

    // Get all active staff members
    const { data: staffList, error: staffError } = await supabase
      .from('staff_users')
      .select('id, full_name, email')
      .eq('is_active', true)

    if (staffError) {
      throw staffError
    }

    // For each staff member, get their verification performance
    const performanceData = await Promise.all(
      staffList.map(async (staff) => {
        // Get verification steps completed by this staff member in the date range
        const { data: stepsCompleted, error: stepsError } = await supabase
          .from('verification_steps')
          .select('id, step_number, step_type, overall_pass, completed_at, reference_id')
          .eq('completed_by', staff.id)
          .gte('completed_at', startDate.toISOString())
          .lte('completed_at', endDate.toISOString())

        if (stepsError) {
          console.error(`Error fetching steps for staff ${staff.id}:`, stepsError)
          return {
            staffId: staff.id,
            staffName: staff.full_name,
            email: staff.email,
            stepsCompleted: 0,
            referencesVerified: 0,
            passRate: 0,
            stepBreakdown: { step1: 0, step2: 0, step3: 0, step4: 0 }
          }
        }

        // Count unique references verified (references where all 4 steps completed by this staff)
        const uniqueReferences = new Set(stepsCompleted?.map(s => s.reference_id) || [])

        // Get references that were fully verified by this staff member (all 4 steps completed)
        const referencesFullyVerified = await Promise.all(
          Array.from(uniqueReferences).map(async (refId) => {
            const { count } = await supabase
              .from('verification_steps')
              .select('id', { count: 'exact' })
              .eq('reference_id', refId)
              .eq('completed_by', staff.id)
              .not('completed_at', 'is', null)

            return count === 4 ? 1 : 0
          })
        )

        const totalReferencesVerified = referencesFullyVerified.reduce((sum, val) => sum + val, 0)

        // Calculate pass rate (steps with overall_pass = true)
        const passedSteps = stepsCompleted?.filter(s => s.overall_pass === true).length || 0
        const passRate = stepsCompleted && stepsCompleted.length > 0
          ? Math.round((passedSteps / stepsCompleted.length) * 100)
          : 0

        // Step breakdown
        const stepBreakdown = {
          step1: stepsCompleted?.filter(s => s.step_number === 1).length || 0,
          step2: stepsCompleted?.filter(s => s.step_number === 2).length || 0,
          step3: stepsCompleted?.filter(s => s.step_number === 3).length || 0,
          step4: stepsCompleted?.filter(s => s.step_number === 4).length || 0
        }

        return {
          staffId: staff.id,
          staffName: staff.full_name,
          email: staff.email,
          stepsCompleted: stepsCompleted?.length || 0,
          referencesVerified: totalReferencesVerified,
          passRate,
          stepBreakdown
        }
      })
    )

    // Sort by steps completed (leaderboard style)
    const sortedPerformance = performanceData.sort((a, b) => b.stepsCompleted - a.stepsCompleted)

    // Calculate totals
    const totalStepsCompleted = sortedPerformance.reduce((sum, staff) => sum + staff.stepsCompleted, 0)
    const totalReferencesVerified = sortedPerformance.reduce((sum, staff) => sum + staff.referencesVerified, 0)

    res.json({
      date: date || 'today',
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      totals: {
        stepsCompleted: totalStepsCompleted,
        referencesVerified: totalReferencesVerified,
        activeStaff: staffList.length
      },
      leaderboard: sortedPerformance
    })
  } catch (error) {
    console.error('Error fetching staff performance:', error)
    res.status(500).json({ error: 'Failed to fetch staff performance statistics' })
  }
})

export default router
