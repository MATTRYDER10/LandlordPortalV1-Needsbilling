import { Router, Request, Response } from 'express'
import { supabase } from '../config/supabase'
import { authenticateAdmin } from '../middleware/adminAuth'
import { decrypt } from '../services/encryption'

const router = Router()

// Apply admin authentication to all routes
router.use(authenticateAdmin)

/**
 * GET /api/admin/reports/revenue/trends
 * Returns revenue trends over time with breakdown by source
 */
router.get('/revenue/trends', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, groupBy = 'day' } = req.query

    // Default to last 30 days if no dates provided
    const end = endDate ? new Date(endDate as string) : new Date()
    const start = startDate ? new Date(startDate as string) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000)

    // Get credit transactions (packs and subscriptions)
    const { data: creditTransactions, error: creditError } = await supabase
      .from('credit_transactions')
      .select('created_at, type, amount_gbp')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .in('type', ['pack_purchase', 'subscription_credit'])
      .order('created_at')

    if (creditError) throw creditError

    // Get agreement payments
    const { data: agreementPayments, error: agreementError } = await supabase
      .from('agreement_payments')
      .select('created_at, amount_gbp')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .eq('payment_status', 'succeeded')
      .order('created_at')

    if (agreementError) throw agreementError

    // Group data by time period
    const revenueData: any[] = []
    const dateMap = new Map<string, { date: string; subscriptions: number; packs: number; agreements: number; total: number }>()

    // Helper to format date based on groupBy
    const formatDate = (date: Date) => {
      if (groupBy === 'week') {
        const weekStart = new Date(date)
        weekStart.setDate(date.getDate() - date.getDay())
        return weekStart.toISOString().split('T')[0]
      } else if (groupBy === 'month') {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      }
      return date.toISOString().split('T')[0] // day
    }

    // Process credit transactions
    creditTransactions?.forEach((transaction: any) => {
      const dateKey = formatDate(new Date(transaction.created_at))
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, { date: dateKey, subscriptions: 0, packs: 0, agreements: 0, total: 0 })
      }
      const entry = dateMap.get(dateKey)!
      const amount = parseFloat(transaction.amount_gbp || '0')

      if (transaction.type === 'subscription_credit') {
        entry.subscriptions += amount
      } else if (transaction.type === 'pack_purchase') {
        entry.packs += amount
      }
      entry.total += amount
    })

    // Process agreement payments
    agreementPayments?.forEach((payment: any) => {
      const dateKey = formatDate(new Date(payment.created_at))
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, { date: dateKey, subscriptions: 0, packs: 0, agreements: 0, total: 0 })
      }
      const entry = dateMap.get(dateKey)!
      const amount = parseFloat(payment.amount_gbp || '0')
      entry.agreements += amount
      entry.total += amount
    })

    // Convert map to sorted array
    const sortedData = Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date))

    // Calculate totals
    const totals = {
      subscriptions: sortedData.reduce((sum, entry) => sum + entry.subscriptions, 0),
      packs: sortedData.reduce((sum, entry) => sum + entry.packs, 0),
      agreements: sortedData.reduce((sum, entry) => sum + entry.agreements, 0),
      total: sortedData.reduce((sum, entry) => sum + entry.total, 0)
    }

    res.json({
      trends: sortedData,
      totals,
      period: { start: start.toISOString(), end: end.toISOString(), groupBy }
    })
  } catch (error) {
    console.error('Error fetching revenue trends:', error)
    res.status(500).json({ error: 'Failed to fetch revenue trends' })
  }
})

/**
 * GET /api/admin/reports/references/pipeline-funnel
 * Returns reference pipeline conversion funnel
 */
router.get('/references/pipeline-funnel', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query

    const end = endDate ? new Date(endDate as string) : new Date()
    const start = startDate ? new Date(startDate as string) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000)

    // Get all references in date range
    const { data: references, error } = await supabase
      .from('tenant_references')
      .select('id, status, created_at, completed_at')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())

    if (error) throw error

    // Count by status
    const statusCounts = {
      draft: 0,
      in_progress: 0,
      pending_verification: 0,
      completed: 0,
      rejected: 0,
      total: references?.length || 0
    }

    references?.forEach((ref: any) => {
      if (ref.status === 'draft') statusCounts.draft++
      else if (ref.status === 'in_progress') statusCounts.in_progress++
      else if (ref.status === 'pending_verification') statusCounts.pending_verification++
      else if (ref.status === 'completed') statusCounts.completed++
      else if (ref.status === 'rejected') statusCounts.rejected++
    })

    // Calculate conversion rates
    const funnel = [
      {
        stage: 'Created',
        count: statusCounts.total,
        percentage: 100,
        conversionFromPrevious: null
      },
      {
        stage: 'In Progress',
        count: statusCounts.in_progress + statusCounts.pending_verification + statusCounts.completed,
        percentage: statusCounts.total > 0
          ? ((statusCounts.in_progress + statusCounts.pending_verification + statusCounts.completed) / statusCounts.total * 100).toFixed(1)
          : 0,
        conversionFromPrevious: statusCounts.total > 0
          ? ((statusCounts.in_progress + statusCounts.pending_verification + statusCounts.completed) / statusCounts.total * 100).toFixed(1)
          : 0
      },
      {
        stage: 'Pending Verification',
        count: statusCounts.pending_verification + statusCounts.completed,
        percentage: statusCounts.total > 0
          ? ((statusCounts.pending_verification + statusCounts.completed) / statusCounts.total * 100).toFixed(1)
          : 0,
        conversionFromPrevious: (statusCounts.in_progress + statusCounts.pending_verification + statusCounts.completed) > 0
          ? ((statusCounts.pending_verification + statusCounts.completed) / (statusCounts.in_progress + statusCounts.pending_verification + statusCounts.completed) * 100).toFixed(1)
          : 0
      },
      {
        stage: 'Completed',
        count: statusCounts.completed,
        percentage: statusCounts.total > 0
          ? (statusCounts.completed / statusCounts.total * 100).toFixed(1)
          : 0,
        conversionFromPrevious: (statusCounts.pending_verification + statusCounts.completed) > 0
          ? (statusCounts.completed / (statusCounts.pending_verification + statusCounts.completed) * 100).toFixed(1)
          : 0
      }
    ]

    // Calculate average completion time
    const completedRefs = references?.filter((ref: any) => ref.completed_at) || []
    let avgCompletionTime = 0
    if (completedRefs.length > 0) {
      const totalTime = completedRefs.reduce((sum: number, ref: any) => {
        const created = new Date(ref.created_at).getTime()
        const completed = new Date(ref.completed_at).getTime()
        return sum + (completed - created)
      }, 0)
      avgCompletionTime = totalTime / completedRefs.length / (1000 * 60 * 60) // Convert to hours
    }

    res.json({
      funnel,
      statusBreakdown: statusCounts,
      avgCompletionTimeHours: avgCompletionTime.toFixed(1),
      period: { start: start.toISOString(), end: end.toISOString() }
    })
  } catch (error) {
    console.error('Error fetching pipeline funnel:', error)
    res.status(500).json({ error: 'Failed to fetch pipeline funnel' })
  }
})

/**
 * GET /api/admin/reports/staff/performance-detail
 * Returns detailed staff performance metrics
 */
router.get('/staff/performance-detail', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, staffId } = req.query

    const end = endDate ? new Date(endDate as string) : new Date()
    const start = startDate ? new Date(startDate as string) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000)

    // Build query for verification steps
    let query = supabase
      .from('verification_steps')
      .select(`
        id,
        step_type,
        overall_pass,
        completed_at,
        completed_by,
        staff_users!verification_steps_completed_by_fkey (
          id,
          full_name,
          email
        )
      `)
      .gte('completed_at', start.toISOString())
      .lte('completed_at', end.toISOString())
      .not('completed_at', 'is', null)

    if (staffId) {
      query = query.eq('completed_by', staffId)
    }

    const { data: steps, error } = await query

    if (error) throw error

    // Group by staff member
    const staffMap = new Map<string, any>()

    steps?.forEach((step: any) => {
      if (!step.staff_users) return

      const staffKey = step.staff_users.id
      if (!staffMap.has(staffKey)) {
        staffMap.set(staffKey, {
          staffId: step.staff_users.id,
          staffName: step.staff_users.full_name,
          staffEmail: step.staff_users.email,
          totalSteps: 0,
          passedSteps: 0,
          failedSteps: 0,
          passRate: 0,
          stepBreakdown: {
            ID_SELFIE: { total: 0, passed: 0 },
            INCOME_AFFORDABILITY: { total: 0, passed: 0 },
            RESIDENTIAL: { total: 0, passed: 0 },
            CREDIT_TAS: { total: 0, passed: 0 }
          }
        })
      }

      const staff = staffMap.get(staffKey)
      staff.totalSteps++

      if (step.overall_pass) {
        staff.passedSteps++
      } else {
        staff.failedSteps++
      }

      // Track by step type
      if (staff.stepBreakdown[step.step_type]) {
        staff.stepBreakdown[step.step_type].total++
        if (step.overall_pass) {
          staff.stepBreakdown[step.step_type].passed++
        }
      }
    })

    // Calculate pass rates
    const staffPerformance = Array.from(staffMap.values()).map(staff => {
      staff.passRate = staff.totalSteps > 0
        ? ((staff.passedSteps / staff.totalSteps) * 100).toFixed(1)
        : '0.0'

      // Calculate pass rate for each step type
      Object.keys(staff.stepBreakdown).forEach(stepName => {
        const step = staff.stepBreakdown[stepName]
        step.passRate = step.total > 0
          ? ((step.passed / step.total) * 100).toFixed(1)
          : '0.0'
      })

      return staff
    })

    // Sort by total steps completed
    staffPerformance.sort((a, b) => b.totalSteps - a.totalSteps)

    res.json({
      performance: staffPerformance,
      period: { start: start.toISOString(), end: end.toISOString() }
    })
  } catch (error: any) {
    console.error('Error fetching staff performance detail:', JSON.stringify(error, null, 2))
    res.status(500).json({ error: 'Failed to fetch staff performance detail', details: error.message })
  }
})

/**
 * GET /api/admin/reports/customers/segmentation
 * Returns customer segmentation (high-value, at-risk, growth, dormant)
 */
router.get('/customers/segmentation', async (req: Request, res: Response) => {
  try {
    // Get all companies with their reference counts and spending
    const { data: companies, error: companiesError } = await supabase
      .from('companies')
      .select(`
        id,
        name_encrypted,
        email_encrypted,
        reference_credits,
        created_at,
        tenant_references (
          id,
          created_at,
          status
        )
      `)

    if (companiesError) throw companiesError

    // Get credit transactions to calculate spending
    const { data: transactions, error: transactionsError } = await supabase
      .from('credit_transactions')
      .select('company_id, amount_gbp, created_at, type')
      .in('type', ['pack_purchase', 'subscription_credit'])

    if (transactionsError) throw transactionsError

    // Calculate metrics for each company
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)

    const segments = {
      highValue: [] as any[],
      atRisk: [] as any[],
      growth: [] as any[],
      dormant: [] as any[]
    }

    companies?.forEach((company: any) => {
      const companyTransactions = transactions?.filter((t: any) => t.company_id === company.id) || []
      const totalSpent = companyTransactions.reduce((sum, t) => sum + parseFloat(t.amount_gbp || '0'), 0)

      const recentRefs = company.tenant_references?.filter((r: any) =>
        new Date(r.created_at) >= thirtyDaysAgo
      ).length || 0

      const previousRefs = company.tenant_references?.filter((r: any) => {
        const created = new Date(r.created_at)
        return created >= sixtyDaysAgo && created < thirtyDaysAgo
      }).length || 0

      const totalRefs = company.tenant_references?.length || 0
      const lastRefDate = company.tenant_references?.length > 0
        ? new Date(Math.max(...company.tenant_references.map((r: any) => new Date(r.created_at).getTime())))
        : null

      const daysSinceLastRef = lastRefDate
        ? Math.floor((now.getTime() - lastRefDate.getTime()) / (1000 * 60 * 60 * 24))
        : null

      const companyData = {
        companyId: company.id,
        companyName: decrypt(company.name_encrypted) || 'Unknown Company',
        companyEmail: decrypt(company.email_encrypted) || '',
        totalSpent: totalSpent.toFixed(2),
        totalReferences: totalRefs,
        recentReferences: recentRefs,
        previousReferences: previousRefs,
        currentCredits: company.reference_credits,
        daysSinceLastReference: daysSinceLastRef,
        memberSince: company.created_at
      }

      // Segmentation logic
      if (totalSpent > 100 && recentRefs > 2) {
        // High-value: High spending + active usage
        segments.highValue.push(companyData)
      } else if (totalRefs > 3 && daysSinceLastRef && daysSinceLastRef > 30) {
        // At-risk: Previous activity but now dormant
        segments.atRisk.push(companyData)
      } else if (recentRefs > previousRefs && previousRefs >= 0 && recentRefs > 0) {
        // Growth: Increasing usage trend
        segments.growth.push(companyData)
      } else if (daysSinceLastRef && daysSinceLastRef > 60) {
        // Dormant: No recent activity
        segments.dormant.push(companyData)
      } else if (totalRefs > 0) {
        // Default to growth if they have any activity
        segments.growth.push(companyData)
      }
    })

    // Sort each segment by total spent
    Object.keys(segments).forEach(key => {
      segments[key as keyof typeof segments].sort((a, b) =>
        parseFloat(b.totalSpent) - parseFloat(a.totalSpent)
      )
    })

    res.json({
      segments,
      summary: {
        highValue: segments.highValue.length,
        atRisk: segments.atRisk.length,
        growth: segments.growth.length,
        dormant: segments.dormant.length,
        total: companies?.length || 0
      }
    })
  } catch (error: any) {
    console.error('Error fetching customer segmentation:', JSON.stringify(error, null, 2))
    res.status(500).json({ error: 'Failed to fetch customer segmentation', details: error.message })
  }
})

/**
 * GET /api/admin/reports/references/outcomes
 * Returns reference outcome statistics
 */
router.get('/references/outcomes', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query

    const end = endDate ? new Date(endDate as string) : new Date()
    const start = startDate ? new Date(startDate as string) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000)

    // Get completed references with their scores and verification checks
    const { data: references, error: referencesError } = await supabase
      .from('tenant_references')
      .select(`
        id,
        status,
        created_at,
        completed_at,
        reference_scores (
          decision,
          score_total,
          decline_reasons
        ),
        verification_checks (
          tas_category
        )
      `)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .not('completed_at', 'is', null)

    if (referencesError) throw referencesError

    // Count outcomes
    const outcomes = {
      PASS: 0,
      PASS_WITH_GUARANTOR: 0,
      MANUAL_REVIEW: 0,
      DECLINE: 0,
      NO_DECISION: 0
    }

    const tasCategories = {
      PASS_PLUS: 0,
      PASS: 0,
      PASS_WITH_GUARANTOR: 0,
      REFER: 0,
      FAIL: 0,
      NOT_SCORED: 0
    }

    const declineReasons: { [key: string]: number } = {}
    let totalScore = 0
    let scoredCount = 0

    references?.forEach((ref: any) => {
      const score = ref.reference_scores
      const verificationCheck = ref.verification_checks

      if (score) {
        // Count decisions
        if (score.decision) {
          outcomes[score.decision as keyof typeof outcomes]++
        } else {
          outcomes.NO_DECISION++
        }

        // Track scores
        if (score.score_total !== null) {
          totalScore += score.score_total
          scoredCount++
        }

        // Track decline reasons
        if (score.decline_reasons && Array.isArray(score.decline_reasons)) {
          score.decline_reasons.forEach((reason: string) => {
            declineReasons[reason] = (declineReasons[reason] || 0) + 1
          })
        }
      } else {
        outcomes.NO_DECISION++
      }

      // Count TAS categories from verification_checks
      if (verificationCheck && verificationCheck.tas_category) {
        tasCategories[verificationCheck.tas_category as keyof typeof tasCategories]++
      } else {
        tasCategories.NOT_SCORED++
      }
    })

    const avgScore = scoredCount > 0 ? (totalScore / scoredCount).toFixed(1) : '0.0'
    const totalRefs = references?.length || 0

    // Calculate percentages
    const outcomePercentages = Object.entries(outcomes).map(([decision, count]) => ({
      decision,
      count,
      percentage: totalRefs > 0 ? ((count / totalRefs) * 100).toFixed(1) : '0.0'
    }))

    const tasPercentages = Object.entries(tasCategories).map(([category, count]) => ({
      category,
      count,
      percentage: totalRefs > 0 ? ((count / totalRefs) * 100).toFixed(1) : '0.0'
    }))

    // Sort decline reasons by frequency
    const topDeclineReasons = Object.entries(declineReasons)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([reason, count]) => ({ reason, count }))

    res.json({
      outcomes: outcomePercentages,
      tasCategories: tasPercentages,
      averageScore: avgScore,
      topDeclineReasons,
      totalReferences: totalRefs,
      period: { start: start.toISOString(), end: end.toISOString() }
    })
  } catch (error: any) {
    console.error('Error fetching reference outcomes:', JSON.stringify(error, null, 2))
    res.status(500).json({ error: 'Failed to fetch reference outcomes', details: error.message })
  }
})

export default router
