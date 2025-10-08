import { Router } from 'express'
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth'
import { supabase } from '../config/supabase'

const router = Router()

/**
 * GET /api/audit-logs
 * Get audit logs for the company (admin only)
 * Supports pagination and filtering
 *
 * Query parameters:
 * - page: number (default: 1)
 * - limit: number (default: 50, max: 100)
 * - action_type: string (filter by action type)
 * - resource_type: string (filter by resource type)
 * - user_id: string (filter by user who performed action)
 * - start_date: ISO date string (filter by date range start)
 * - end_date: ISO date string (filter by date range end)
 */
router.get('/', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const companyId = req.companyId
    const {
      page = '1',
      limit = '50',
      action_type,
      resource_type,
      user_id,
      start_date,
      end_date
    } = req.query

    // Validate and sanitize pagination
    const pageNum = Math.max(1, parseInt(page as string))
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string)))
    const offset = (pageNum - 1) * limitNum

    // Build query
    let query = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })

    // Apply filters
    if (action_type) {
      query = query.eq('action_type', action_type)
    }

    if (resource_type) {
      query = query.eq('resource_type', resource_type)
    }

    if (user_id) {
      query = query.eq('user_id', user_id)
    }

    if (start_date) {
      query = query.gte('created_at', start_date)
    }

    if (end_date) {
      query = query.lte('created_at', end_date)
    }

    // Apply pagination
    query = query.range(offset, offset + limitNum - 1)

    const { data: logs, error, count } = await query

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    // Enrich logs with user information
    const userIds = [...new Set(logs?.map(log => log.user_id).filter(Boolean) || [])]
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers()

    if (usersError) {
      console.error('Failed to fetch user details:', usersError)
    }

    const userMap = new Map(users?.map(u => [u.id, u]) || [])

    const enrichedLogs = logs?.map(log => ({
      ...log,
      user: log.user_id ? {
        id: log.user_id,
        email: userMap.get(log.user_id)?.email,
        name: userMap.get(log.user_id)?.user_metadata?.full_name
      } : null
    }))

    res.json({
      logs: enrichedLogs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limitNum)
      }
    })
  } catch (error: any) {
    console.error('Error fetching audit logs:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/audit-logs/summary
 * Get summary statistics for audit logs (admin only)
 */
router.get('/summary', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const companyId = req.companyId
    const { start_date, end_date } = req.query

    // Build base query
    let query = supabase
      .from('audit_logs')
      .select('action_type, user_id, created_at')
      .eq('company_id', companyId)

    if (start_date) {
      query = query.gte('created_at', start_date)
    }

    if (end_date) {
      query = query.lte('created_at', end_date)
    }

    const { data: logs, error } = await query

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    // Calculate summary statistics
    const summary = {
      totalActions: logs?.length || 0,
      actionsByType: {} as Record<string, number>,
      actionsByUser: {} as Record<string, number>,
      recentActivity: logs?.slice(0, 10).map(log => ({
        action_type: log.action_type,
        user_id: log.user_id,
        created_at: log.created_at
      })) || []
    }

    // Count by action type
    logs?.forEach(log => {
      summary.actionsByType[log.action_type] = (summary.actionsByType[log.action_type] || 0) + 1

      if (log.user_id) {
        summary.actionsByUser[log.user_id] = (summary.actionsByUser[log.user_id] || 0) + 1
      }
    })

    res.json(summary)
  } catch (error: any) {
    console.error('Error fetching audit log summary:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/audit-logs/export
 * Export audit logs as CSV (admin only)
 */
router.get('/export', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const companyId = req.companyId
    const { start_date, end_date } = req.query

    // Build query
    let query = supabase
      .from('audit_logs')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })

    if (start_date) {
      query = query.gte('created_at', start_date)
    }

    if (end_date) {
      query = query.lte('created_at', end_date)
    }

    const { data: logs, error } = await query

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    // Get user information for enrichment
    const userIds = [...new Set(logs?.map(log => log.user_id).filter(Boolean) || [])]
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers()

    if (usersError) {
      console.error('Failed to fetch user details:', usersError)
    }

    const userMap = new Map(users?.map(u => [u.id, {
      email: u.email,
      name: u.user_metadata?.full_name
    }]) || [])

    // Generate CSV
    const headers = ['Date/Time', 'User', 'Email', 'Action', 'Resource Type', 'Description', 'IP Address']
    const csvRows = [headers.join(',')]

    logs?.forEach(log => {
      const user = log.user_id ? userMap.get(log.user_id) : null
      const row = [
        new Date(log.created_at).toISOString(),
        user?.name || 'System',
        user?.email || '-',
        log.action_type,
        log.resource_type,
        `"${log.description.replace(/"/g, '""')}"`, // Escape quotes in description
        log.ip_address || '-'
      ]
      csvRows.push(row.join(','))
    })

    const csv = csvRows.join('\n')

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.csv"`)
    res.send(csv)
  } catch (error: any) {
    console.error('Error exporting audit logs:', error)
    res.status(500).json({ error: error.message })
  }
})

export default router
