import express from 'express'
import { supabase } from '../config/supabase'
import { authenticateAdmin, AdminAuthRequest } from '../middleware/adminAuth'
import { decrypt } from '../services/encryption'

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
          companyName: decrypt(company.name_encrypted),
          companyEmail: decrypt(company.email_encrypted),
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
    const { dateRange } = req.query

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

    // Override today's range if dateRange is specified
    let actualToday = today
    let actualTodayEnd = todayEnd
    if (dateRange === '7days') {
      actualToday = new Date()
      actualToday.setDate(actualToday.getDate() - 7)
      actualToday.setHours(0, 0, 0, 0)
      actualTodayEnd = new Date()
      actualTodayEnd.setHours(23, 59, 59, 999)
    } else if (dateRange === '14days') {
      actualToday = new Date()
      actualToday.setDate(actualToday.getDate() - 14)
      actualToday.setHours(0, 0, 0, 0)
      actualTodayEnd = new Date()
      actualTodayEnd.setHours(23, 59, 59, 999)
    } else if (dateRange === '30days') {
      actualToday = new Date()
      actualToday.setDate(actualToday.getDate() - 30)
      actualToday.setHours(0, 0, 0, 0)
      actualTodayEnd = new Date()
      actualTodayEnd.setHours(23, 59, 59, 999)
    }

    // Parallel queries for better performance
    const [
      todayRefsSubmitted,
      todayRefsCompleted,
      todayBusinesses,
      todayCreditRevenue,
      todayAgreementRevenue,
      todayCreditsAdded,
      todayCreditsUsed,
      yesterdayRefsSubmitted,
      yesterdayRefsCompleted,
      yesterdayBusinesses,
      yesterdayCreditRevenue,
      yesterdayAgreementRevenue,
      yesterdayCreditsAdded,
      yesterdayCreditsUsed,
      totalCompanies,
      totalReferences,
      activeStaff
    ] = await Promise.all([
      // Today's stats (or date range if specified)
      supabase.from('tenant_references').select('id', { count: 'exact' }).gte('created_at', actualToday.toISOString()).lte('created_at', actualTodayEnd.toISOString()),
      supabase.from('tenant_references').select('id', { count: 'exact' }).eq('status', 'completed').gte('updated_at', actualToday.toISOString()).lte('updated_at', actualTodayEnd.toISOString()),
      supabase.from('companies').select('id', { count: 'exact' }).gte('created_at', actualToday.toISOString()).lte('created_at', actualTodayEnd.toISOString()),
      supabase.from('credit_transactions').select('amount_gbp').in('type', ['pack_purchase', 'subscription_credit', 'auto_recharge']).gte('created_at', actualToday.toISOString()).lte('created_at', actualTodayEnd.toISOString()),
      supabase.from('agreement_payments').select('amount_gbp').eq('payment_status', 'succeeded').gte('created_at', actualToday.toISOString()).lte('created_at', actualTodayEnd.toISOString()),
      supabase.from('credit_transactions').select('credits_change').in('type', ['pack_purchase', 'subscription_credit', 'auto_recharge']).gte('created_at', actualToday.toISOString()).lte('created_at', actualTodayEnd.toISOString()),
      supabase.from('credit_transactions').select('credits_change').eq('type', 'credit_used').gte('created_at', actualToday.toISOString()).lte('created_at', actualTodayEnd.toISOString()),

      // Yesterday's stats
      supabase.from('tenant_references').select('id', { count: 'exact' }).gte('created_at', yesterday.toISOString()).lte('created_at', yesterdayEnd.toISOString()),
      supabase.from('tenant_references').select('id', { count: 'exact' }).eq('status', 'completed').gte('updated_at', yesterday.toISOString()).lte('updated_at', yesterdayEnd.toISOString()),
      supabase.from('companies').select('id', { count: 'exact' }).gte('created_at', yesterday.toISOString()).lte('created_at', yesterdayEnd.toISOString()),
      supabase.from('credit_transactions').select('amount_gbp').in('type', ['pack_purchase', 'subscription_credit', 'auto_recharge']).gte('created_at', yesterday.toISOString()).lte('created_at', yesterdayEnd.toISOString()),
      supabase.from('agreement_payments').select('amount_gbp').eq('payment_status', 'succeeded').gte('created_at', yesterday.toISOString()).lte('created_at', yesterdayEnd.toISOString()),
      supabase.from('credit_transactions').select('credits_change').in('type', ['pack_purchase', 'subscription_credit', 'auto_recharge']).gte('created_at', yesterday.toISOString()).lte('created_at', yesterdayEnd.toISOString()),
      supabase.from('credit_transactions').select('credits_change').eq('type', 'credit_used').gte('created_at', yesterday.toISOString()).lte('created_at', yesterdayEnd.toISOString()),

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

    // Calculate credits added and used
    const todayTotalCreditsAdded = todayCreditsAdded.data?.reduce((sum, tx) => sum + Math.abs(tx.credits_change || 0), 0) || 0
    const todayTotalCreditsUsed = Math.abs(todayCreditsUsed.data?.reduce((sum, tx) => sum + (tx.credits_change || 0), 0) || 0)

    const yesterdayTotalCreditsAdded = yesterdayCreditsAdded.data?.reduce((sum, tx) => sum + Math.abs(tx.credits_change || 0), 0) || 0
    const yesterdayTotalCreditsUsed = Math.abs(yesterdayCreditsUsed.data?.reduce((sum, tx) => sum + (tx.credits_change || 0), 0) || 0)

    res.json({
      today: {
        referencesSubmitted: todayRefsSubmitted.count || 0,
        referencesCompleted: todayRefsCompleted.count || 0,
        newBusinesses: todayBusinesses.count || 0,
        revenue: todayTotalRevenue.toFixed(2),
        creditsAdded: todayTotalCreditsAdded,
        creditsUsed: todayTotalCreditsUsed
      },
      yesterday: {
        referencesSubmitted: yesterdayRefsSubmitted.count || 0,
        referencesCompleted: yesterdayRefsCompleted.count || 0,
        newBusinesses: yesterdayBusinesses.count || 0,
        revenue: yesterdayTotalRevenue.toFixed(2),
        creditsAdded: yesterdayTotalCreditsAdded,
        creditsUsed: yesterdayTotalCreditsUsed
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
    } else if (date === '7days') {
      startDate = new Date()
      startDate.setDate(startDate.getDate() - 7)
      startDate.setHours(0, 0, 0, 0)
      endDate = new Date()
      endDate.setHours(23, 59, 59, 999)
    } else if (date === '14days') {
      startDate = new Date()
      startDate.setDate(startDate.getDate() - 14)
      startDate.setHours(0, 0, 0, 0)
      endDate = new Date()
      endDate.setHours(23, 59, 59, 999)
    } else if (date === '30days') {
      startDate = new Date()
      startDate.setDate(startDate.getDate() - 30)
      startDate.setHours(0, 0, 0, 0)
      endDate = new Date()
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
        let totalReferencesVerified = 0
        for (const refId of Array.from(uniqueReferences)) {
          const { count } = await supabase
            .from('verification_steps')
            .select('id', { count: 'exact' })
            .eq('reference_id', refId)
            .eq('completed_by', staff.id)
            .not('completed_at', 'is', null)

          if (count === 4) {
            totalReferencesVerified++
          }
        }

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

// Customer Leaderboard Endpoint
router.get('/customers/leaderboard', authenticateAdmin, async (req: AdminAuthRequest, res) => {
  try {
    const { sortBy = 'references', limit = 50 } = req.query

    // Get all companies
    const { data: companies, error } = await supabase
      .from('companies')
      .select('id, name_encrypted, email_encrypted, created_at, reference_credits, stripe_customer_id, onboarding_completed')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching companies:', error)
      throw error
    }

    // Calculate metrics for each company in parallel
    const leaderboardData = await Promise.all(
      companies.map(async (company) => {
        const [referencesResult, teamSizeResult, creditTxResult, agreementPaymentsResult] = await Promise.all([
          // Get total references count
          supabase
            .from('tenant_references')
            .select('id', { count: 'exact', head: true })
            .eq('company_id', company.id),

          // Get team size
          supabase
            .from('company_users')
            .select('id', { count: 'exact', head: true })
            .eq('company_id', company.id),

          // Get credit transaction amounts
          supabase
            .from('credit_transactions')
            .select('amount_gbp')
            .eq('company_id', company.id)
            .in('type', ['pack_purchase', 'subscription_credit', 'auto_recharge'])
            .not('amount_gbp', 'is', null),

          // Get agreement payment amounts
          supabase
            .from('agreement_payments')
            .select('amount_gbp')
            .eq('company_id', company.id)
            .eq('payment_status', 'succeeded')
        ])

        const totalReferences = referencesResult.count || 0
        const teamSize = teamSizeResult.count || 0

        // Calculate total spent from credits and agreements
        const totalCreditsSpent = creditTxResult.data?.reduce((sum, tx) =>
          sum + (parseFloat(tx.amount_gbp?.toString() || '0') || 0), 0) || 0
        const totalAgreementsSpent = agreementPaymentsResult.data?.reduce((sum, payment) =>
          sum + (parseFloat(payment.amount_gbp?.toString() || '0') || 0), 0) || 0
        const totalSpent = totalCreditsSpent + totalAgreementsSpent

        // Determine status
        let status: 'active' | 'no_payment_method' | 'onboarding_incomplete'
        if (company.onboarding_completed && company.stripe_customer_id) {
          status = 'active'
        } else if (!company.onboarding_completed) {
          status = 'onboarding_incomplete'
        } else {
          status = 'no_payment_method'
        }

        return {
          companyId: company.id,
          companyName: decrypt(company.name_encrypted) || 'Unnamed Company',
          companyEmail: decrypt(company.email_encrypted) || '',
          totalReferences,
          totalSpent: totalSpent.toFixed(2),
          teamSize,
          memberSince: company.created_at,
          currentCredits: company.reference_credits || 0,
          isActive: status === 'active',
          status
        }
      })
    )

    // Filter out orphaned companies (0 references, £0 spent, 1 team member, no stripe)
    // These were created by a bug where invited users got their own company
    const filteredData = leaderboardData.filter(company => {
      const isOrphaned = company.totalReferences === 0 &&
        parseFloat(company.totalSpent) === 0 &&
        company.teamSize === 1 &&
        company.status === 'onboarding_incomplete'
      return !isOrphaned
    })

    // Sort based on sortBy parameter
    const sortedData = filteredData.sort((a, b) => {
      switch (sortBy) {
        case 'spent':
          return parseFloat(b.totalSpent) - parseFloat(a.totalSpent)
        case 'teamSize':
          return b.teamSize - a.teamSize
        case 'memberSince':
          return new Date(a.memberSince).getTime() - new Date(b.memberSince).getTime()
        case 'references':
        default:
          return b.totalReferences - a.totalReferences
      }
    })

    const limitNum = parseInt(limit as string) || 50
    res.json({
      leaderboard: sortedData.slice(0, limitNum),
      total: sortedData.length
    })
  } catch (error) {
    console.error('Error fetching customer leaderboard:', error)
    res.status(500).json({ error: 'Failed to fetch customer leaderboard' })
  }
})

// Customer Search Endpoint
router.get('/customers/search', authenticateAdmin, async (req: AdminAuthRequest, res) => {
  try {
    const { query } = req.query

    if (!query || typeof query !== 'string' || query.length < 2) {
      return res.json({ customers: [] })
    }

    const searchLower = query.toLowerCase()

    // Get all companies with their team members
    const { data: companies, error } = await supabase
      .from('companies')
      .select(`
        id,
        name_encrypted,
        email_encrypted,
        created_at,
        reference_credits,
        onboarding_completed,
        company_users (
          user_id
        )
      `)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Get all user IDs from company_users
    const allUserIds = new Set<string>()
    companies.forEach(company => {
      company.company_users?.forEach((cu: any) => {
        if (cu.user_id) allUserIds.add(cu.user_id)
      })
    })

    // Fetch user emails in bulk for searching
    const userEmailMap = new Map<string, string>()
    if (allUserIds.size > 0) {
      const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers({
        perPage: 1000
      })

      if (!usersError && users) {
        users.forEach(user => {
          if (user.email) {
            userEmailMap.set(user.id, user.email)
          }
        })
      }
    }

    // Decrypt and filter companies by search query (company name, company email, or team member email)
    const matchingCompanies = companies
      .map(company => {
        // Get all team member emails for this company
        const teamEmails = company.company_users
          ?.map((cu: any) => userEmailMap.get(cu.user_id) || '')
          .filter((email: string) => email) || []

        return {
          id: company.id,
          name: decrypt(company.name_encrypted) || 'Unnamed Company',
          email: decrypt(company.email_encrypted) || '',
          created_at: company.created_at,
          reference_credits: company.reference_credits,
          onboarding_completed: company.onboarding_completed,
          teamEmails
        }
      })
      .filter(company =>
        company.name.toLowerCase().includes(searchLower) ||
        company.email.toLowerCase().includes(searchLower) ||
        company.teamEmails.some((email: string) => email.toLowerCase().includes(searchLower))
      )
      .map(({ teamEmails, ...company }) => company) // Remove teamEmails from response
      .slice(0, 20) // Limit to 20 results

    res.json({ customers: matchingCompanies })
  } catch (error) {
    console.error('Error searching customers:', error)
    res.status(500).json({ error: 'Failed to search customers' })
  }
})

// Customer Details Endpoint
router.get('/customers/:companyId/details', authenticateAdmin, async (req: AdminAuthRequest, res) => {
  try {
    const { companyId } = req.params

    // Get company details
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single()

    if (companyError || !company) {
      return res.status(404).json({ error: 'Company not found' })
    }

    // Get all related data in parallel
    const [
      referencesResult,
      companyUsersResult,
      creditTxResult,
      agreementPaymentsResult,
      subscriptionResult
    ] = await Promise.all([
      // Get references with status breakdown
      supabase
        .from('tenant_references')
        .select('id, status, created_at')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(50),

      // Get company_users (without the join since auth.users can't be joined directly)
      supabase
        .from('company_users')
        .select('*')
        .eq('company_id', companyId),

      // Get credit transactions
      supabase
        .from('credit_transactions')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(50),

      // Get agreement payments
      supabase
        .from('agreement_payments')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(50),

      // Get active subscription
      supabase
        .from('subscriptions')
        .select('*')
        .eq('company_id', companyId)
        .in('status', ['active', 'trialing'])
        .single()
    ])

    // Fetch user emails from auth.users using admin API
    const teamMembers = await Promise.all(
      (companyUsersResult.data || []).map(async (cu: any) => {
        const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(cu.user_id)
        return {
          id: cu.id,
          role: cu.role,
          joined_at: cu.joined_at || cu.created_at,
          user: userError ? null : {
            id: cu.user_id,
            email: user?.email || 'Unknown'
          }
        }
      })
    )

    // Calculate status breakdown
    const statusBreakdown = referencesResult.data?.reduce((acc, ref) => {
      acc[ref.status] = (acc[ref.status] || 0) + 1
      return acc
    }, {} as Record<string, number>) || {}

    // Calculate total spent
    const totalCreditsSpent = creditTxResult.data?.reduce((sum, tx) =>
      sum + (parseFloat(tx.amount_gbp?.toString() || '0') || 0), 0) || 0
    const totalAgreementsSpent = agreementPaymentsResult.data?.reduce((sum, payment) =>
      sum + (parseFloat(payment.amount_gbp?.toString() || '0') || 0), 0) || 0

    res.json({
      company: {
        id: company.id,
        name: decrypt(company.name_encrypted) || 'Unnamed Company',
        email: decrypt(company.email_encrypted) || '',
        created_at: company.created_at,
        reference_credits: company.reference_credits,
        stripe_customer_id: company.stripe_customer_id,
        onboarding_completed: company.onboarding_completed,
        auto_recharge_enabled: company.auto_recharge_enabled,
        auto_recharge_threshold: company.auto_recharge_threshold,
        auto_recharge_pack_size: company.auto_recharge_pack_size
      },
      stats: {
        totalReferences: referencesResult.count || 0,
        totalCreditsSpent: totalCreditsSpent.toFixed(2),
        totalAgreementsSpent: totalAgreementsSpent.toFixed(2),
        totalSpent: (totalCreditsSpent + totalAgreementsSpent).toFixed(2),
        teamSize: teamMembers.length,
        statusBreakdown
      },
      references: referencesResult.data || [],
      teamMembers,
      creditTransactions: creditTxResult.data || [],
      agreementPayments: agreementPaymentsResult.data || [],
      subscription: subscriptionResult.data || null
    })
  } catch (error) {
    console.error('Error fetching customer details:', error)
    res.status(500).json({ error: 'Failed to fetch customer details' })
  }
})

/**
 * DELETE /api/admin/staff/:staffId
 * Permanently delete a staff account
 * Body: { confirmEmail: string } - Must match staff email for confirmation
 */
router.delete('/staff/:staffId', authenticateAdmin, async (req: AdminAuthRequest, res) => {
  try {
    const { staffId } = req.params
    const { confirmEmail } = req.body

    // 1. Get staff user details
    const { data: staffUser, error: fetchError } = await supabase
      .from('staff_users')
      .select('id, user_id, email, full_name')
      .eq('id', staffId)
      .single()

    if (fetchError || !staffUser) {
      return res.status(404).json({ error: 'Staff user not found' })
    }

    // 2. Verify confirmation email matches
    if (!confirmEmail || confirmEmail.toLowerCase() !== staffUser.email.toLowerCase()) {
      return res.status(400).json({
        error: 'Confirmation email does not match. Please type the email exactly.'
      })
    }

    // 3. Prevent self-deletion
    if (staffUser.user_id === req.user?.id) {
      return res.status(403).json({ error: 'Cannot delete your own account' })
    }

    // 4. Delete from auth.users first (this will cascade to staff_users due to ON DELETE CASCADE)
    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(staffUser.user_id)

    if (authDeleteError) {
      console.error('Error deleting from auth.users:', authDeleteError)
      return res.status(500).json({ error: 'Failed to delete user from authentication system' })
    }

    console.log(`[Admin] Staff user deleted: ${staffUser.email} by ${req.adminUser?.email}`)

    res.json({
      message: 'Staff account deleted successfully',
      deletedUser: {
        id: staffUser.id,
        email: staffUser.email,
        fullName: staffUser.full_name
      }
    })
  } catch (error) {
    console.error('Error deleting staff account:', error)
    res.status(500).json({ error: 'Failed to delete staff account' })
  }
})

/**
 * DELETE /api/admin/customers/:companyId/users/:userId
 * Delete a customer user from a company (and from auth if no other companies)
 * Body: { confirmEmail: string } - Must match user email for confirmation
 */
router.delete('/customers/:companyId/users/:userId', authenticateAdmin, async (req: AdminAuthRequest, res) => {
  try {
    const { companyId, userId } = req.params
    const { confirmEmail } = req.body

    // 1. Get user details from auth
    const { data: { user: authUser }, error: userError } = await supabase.auth.admin.getUserById(userId)

    if (userError || !authUser) {
      return res.status(404).json({ error: 'User not found' })
    }

    // 2. Verify confirmation email matches
    if (!confirmEmail || confirmEmail.toLowerCase() !== authUser.email?.toLowerCase()) {
      return res.status(400).json({
        error: 'Confirmation email does not match. Please type the email exactly.'
      })
    }

    // 3. Verify user belongs to the specified company
    const { data: companyUser, error: companyUserError } = await supabase
      .from('company_users')
      .select('id, role')
      .eq('user_id', userId)
      .eq('company_id', companyId)
      .single()

    if (companyUserError || !companyUser) {
      return res.status(404).json({ error: 'User not found in this company' })
    }

    // 4. Remove user from this company
    const { error: removeError } = await supabase
      .from('company_users')
      .delete()
      .eq('user_id', userId)
      .eq('company_id', companyId)

    if (removeError) {
      throw removeError
    }

    // 5. Check if user belongs to any other companies
    const { data: otherCompanies } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', userId)

    let deletedFromAuth = false

    // 6. If no other companies, delete from auth.users entirely
    if (!otherCompanies || otherCompanies.length === 0) {
      const { error: authDeleteError } = await supabase.auth.admin.deleteUser(userId)

      if (authDeleteError) {
        console.error('Error deleting from auth.users:', authDeleteError)
      } else {
        deletedFromAuth = true
      }
    }

    console.log(`[Admin] Customer user deleted: ${authUser.email} from company ${companyId} by ${req.adminUser?.email}. Deleted from auth: ${deletedFromAuth}`)

    res.json({
      message: deletedFromAuth ? 'User deleted permanently' : 'User removed from company',
      deletedUser: {
        userId: userId,
        email: authUser.email,
        role: companyUser.role,
        deletedFromAuth
      }
    })
  } catch (error) {
    console.error('Error deleting customer user:', error)
    res.status(500).json({ error: 'Failed to delete customer user' })
  }
})

/**
 * DELETE /api/admin/customers/:companyId
 * Permanently delete a company and all associated data
 * Body: { confirmName: string } - Must match company name for confirmation
 */
router.delete('/customers/:companyId', authenticateAdmin, async (req: AdminAuthRequest, res) => {
  try {
    const { companyId } = req.params
    const { confirmName } = req.body

    // 1. Get company details
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id, name_encrypted, email_encrypted')
      .eq('id', companyId)
      .single()

    if (companyError || !company) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const companyName = decrypt(company.name_encrypted) || ''

    // 2. Verify confirmation name matches
    if (!confirmName || confirmName.toLowerCase() !== companyName.toLowerCase()) {
      return res.status(400).json({
        error: 'Confirmation name does not match. Please type the company name exactly.'
      })
    }

    // 3. Get all users who belong to this company
    const { data: companyUsers, error: usersError } = await supabase
      .from('company_users')
      .select('user_id')
      .eq('company_id', companyId)

    if (usersError) {
      console.error('Error fetching company users:', usersError)
    }

    const userIds = companyUsers?.map(cu => cu.user_id) || []

    // 4. Delete the company (this will CASCADE delete most related data)
    const { error: deleteError } = await supabase
      .from('companies')
      .delete()
      .eq('id', companyId)

    if (deleteError) {
      console.error('Error deleting company:', deleteError)
      return res.status(500).json({ error: 'Failed to delete company: ' + deleteError.message })
    }

    // 5. For each user, check if they belong to any other companies
    // If not, delete them from auth.users
    let usersDeleted = 0
    let usersKept = 0

    for (const userId of userIds) {
      const { data: otherCompanies } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', userId)

      if (!otherCompanies || otherCompanies.length === 0) {
        // User doesn't belong to any other company, delete from auth
        const { error: authDeleteError } = await supabase.auth.admin.deleteUser(userId)

        if (authDeleteError) {
          console.error(`Error deleting user ${userId} from auth:`, authDeleteError)
          usersKept++
        } else {
          usersDeleted++
        }
      } else {
        usersKept++
      }
    }

    console.log(`[Admin] Company deleted: ${companyName} by ${req.adminUser?.email}. Users deleted: ${usersDeleted}, Users kept (in other companies): ${usersKept}`)

    res.json({
      message: 'Company deleted successfully',
      deletedCompany: {
        id: companyId,
        name: companyName,
        email: decrypt(company.email_encrypted)
      },
      usersDeleted,
      usersKept
    })
  } catch (error) {
    console.error('Error deleting company:', error)
    res.status(500).json({ error: 'Failed to delete company' })
  }
})

// Customer Credit Adjustment Endpoint
router.post('/customers/:companyId/credits', authenticateAdmin, async (req: AdminAuthRequest, res) => {
  try {
    const { companyId } = req.params
    const { amount, reason } = req.body

    if (!amount || typeof amount !== 'number' || amount === 0) {
      return res.status(400).json({ error: 'Valid amount is required' })
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return res.status(400).json({ error: 'Reason is required' })
    }

    // Get current company details
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id, reference_credits, name_encrypted')
      .eq('id', companyId)
      .single()

    if (companyError || !company) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const currentCredits = company.reference_credits || 0
    const newBalance = currentCredits + amount

    if (newBalance < 0) {
      return res.status(400).json({
        error: `Cannot reduce credits below 0. Current balance: ${currentCredits}, Adjustment: ${amount}`
      })
    }

    // Update company credits
    const { error: updateError } = await supabase
      .from('companies')
      .update({ reference_credits: newBalance })
      .eq('id', companyId)

    if (updateError) throw updateError

    // Create credit transaction record
    const { error: txError } = await supabase
      .from('credit_transactions')
      .insert({
        company_id: companyId,
        type: 'manual_adjustment',
        credits_change: amount,
        credits_balance_after: newBalance,
        amount_gbp: null,
        description: `Manual adjustment by admin: ${reason}`,
        metadata: {
          adjusted_by: req.adminUser?.id,
          adjusted_by_name: req.adminUser?.full_name,
          reason
        },
        created_by: req.user?.id
      })

    if (txError) throw txError

    console.log(`[Admin] Credits adjusted for ${decrypt(company.name_encrypted)}: ${amount} credits (${currentCredits} → ${newBalance}). Reason: ${reason}`)

    res.json({
      success: true,
      message: `Credits ${amount > 0 ? 'added' : 'removed'} successfully`,
      previousBalance: currentCredits,
      newBalance,
      adjustment: amount
    })
  } catch (error) {
    console.error('Error adjusting customer credits:', error)
    res.status(500).json({ error: 'Failed to adjust customer credits' })
  }
})

/**
 * GET /api/admin/references/search
 * Search all references with optional filters
 * Query params: query (search string), status (filter), limit, offset
 */
router.get('/references/search', authenticateAdmin, async (req: AdminAuthRequest, res) => {
  try {
    const { query, status, limit = '50', offset = '0' } = req.query
    const limitNum = parseInt(limit as string, 10)
    const offsetNum = parseInt(offset as string, 10)

    // Build the query - fetch all references with company info
    let dbQuery = supabase
      .from('tenant_references')
      .select(`
        id,
        tenant_first_name_encrypted,
        tenant_last_name_encrypted,
        tenant_email_encrypted,
        tenant_phone_encrypted,
        property_address_encrypted,
        status,
        move_in_date,
        created_at,
        updated_at,
        is_guarantor,
        requires_guarantor,
        parent_reference_id,
        company_id,
        companies (
          id,
          name_encrypted
        )
      `, { count: 'exact' })
      .eq('is_guarantor', false)
      .order('created_at', { ascending: false })

    // Apply status filter if provided
    if (status && status !== 'all') {
      dbQuery = dbQuery.eq('status', status)
    }

    // Execute main query with pagination
    const { data: references, error, count } = await dbQuery
      .range(offsetNum, offsetNum + limitNum - 1)

    if (error) throw error

    // If there's a search query, we need to decrypt and filter
    // Also fetch guarantor info for references that require it
    const guarantorRefIds = references
      ?.filter(ref => ref.requires_guarantor)
      .map(ref => ref.id) || []

    let guarantorMap: Record<string, any> = {}
    if (guarantorRefIds.length > 0) {
      const { data: guarantors } = await supabase
        .from('tenant_references')
        .select('parent_reference_id, tenant_first_name_encrypted, tenant_last_name_encrypted, status')
        .eq('is_guarantor', true)
        .in('parent_reference_id', guarantorRefIds)

      if (guarantors) {
        guarantors.forEach(g => {
          guarantorMap[g.parent_reference_id] = {
            name: `${decrypt(g.tenant_first_name_encrypted) || ''} ${decrypt(g.tenant_last_name_encrypted) || ''}`.trim(),
            status: g.status
          }
        })
      }
    }

    // Decrypt and enrich reference data
    let enrichedRefs = references?.map(ref => {
      const tenantFirstName = decrypt(ref.tenant_first_name_encrypted) || ''
      const tenantLastName = decrypt(ref.tenant_last_name_encrypted) || ''
      const tenantEmail = decrypt(ref.tenant_email_encrypted) || ''
      const tenantPhone = decrypt(ref.tenant_phone_encrypted) || ''
      const propertyAddress = decrypt(ref.property_address_encrypted) || ''

      return {
        id: ref.id,
        tenant_name: `${tenantFirstName} ${tenantLastName}`.trim(),
        tenant_first_name: tenantFirstName,
        tenant_last_name: tenantLastName,
        tenant_email: tenantEmail,
        tenant_phone: tenantPhone,
        property_address: propertyAddress,
        status: ref.status,
        move_in_date: ref.move_in_date,
        created_at: ref.created_at,
        updated_at: ref.updated_at,
        requires_guarantor: ref.requires_guarantor,
        company_name: decrypt((ref.companies as any)?.name_encrypted) || 'Unknown',
        company_id: ref.company_id,
        guarantor: ref.requires_guarantor ? guarantorMap[ref.id] || null : null
      }
    }) || []

    // Apply search filter if query provided (client-side filtering on decrypted data)
    if (query && typeof query === 'string' && query.length >= 2) {
      const searchLower = query.toLowerCase()
      enrichedRefs = enrichedRefs.filter(ref =>
        ref.tenant_name.toLowerCase().includes(searchLower) ||
        ref.property_address.toLowerCase().includes(searchLower) ||
        ref.company_name.toLowerCase().includes(searchLower) ||
        ref.tenant_email.toLowerCase().includes(searchLower) ||
        (ref.guarantor?.name && ref.guarantor.name.toLowerCase().includes(searchLower))
      )
    }

    res.json({
      references: enrichedRefs,
      total: query ? enrichedRefs.length : count,
      limit: limitNum,
      offset: offsetNum
    })
  } catch (error: any) {
    console.error('Error searching references:', error?.message || error)
    console.error('Full error:', JSON.stringify(error, null, 2))
    res.status(500).json({ error: 'Failed to search references', details: error?.message })
  }
})

export default router
