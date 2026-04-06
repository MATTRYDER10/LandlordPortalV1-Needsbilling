import express, { Request, Response } from 'express'
import { supabase as supabaseAdmin } from '../config/supabase'
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  dismissNotification
} from '../services/notificationService'

const router = express.Router()

// Middleware to verify auth and get user/company info
const authMiddleware = async (req: Request, res: Response, next: Function) => {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' })
  }

  const token = authHeader.split(' ')[1]

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' })
    }

    // Check for X-Branch-Id header first (multi-branch support)
    const branchId = req.headers['x-branch-id'] as string | undefined
    let companyId: string | null = null

    if (branchId) {
      // Verify user belongs to this branch
      const { data: branchMembership } = await supabaseAdmin
        .from('company_users')
        .select('company_id')
        .eq('user_id', user.id)
        .eq('company_id', branchId)
        .limit(1)

      if (branchMembership && branchMembership.length > 0) {
        companyId = branchMembership[0].company_id
      }
    }

    // Fallback: Get user's first company (don't use .single() for multi-branch users)
    if (!companyId) {
      const { data: companyUsers } = await supabaseAdmin
        .from('company_users')
        .select('company_id')
        .eq('user_id', user.id)
        .limit(1)

      if (companyUsers && companyUsers.length > 0) {
        companyId = companyUsers[0].company_id
      }
    }

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with a company' })
    }

    req.user = user
    req.companyId = companyId
    next()
  } catch (err) {
    return res.status(500).json({ error: 'Authentication failed' })
  }
}

// Apply auth middleware to all routes
router.use(authMiddleware)

/**
 * GET /api/notifications
 * Get notifications for the current user/company
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50
    const includeRead = req.query.includeRead === 'true'
    const includeDismissed = req.query.includeDismissed === 'true'

    const notifications = await getNotifications(req.companyId!, req.user!.id, {
      limit,
      includeRead,
      includeDismissed
    })

    res.json({ notifications })
  } catch (err) {
    console.error('Error fetching notifications:', err)
    res.status(500).json({ error: 'Failed to fetch notifications' })
  }
})

/**
 * GET /api/notifications/count
 * Get unread notification count for badge
 */
router.get('/count', async (req: Request, res: Response) => {
  try {
    const count = await getUnreadCount(req.companyId!, req.user!.id)
    res.json({ count })
  } catch (err) {
    console.error('Error fetching notification count:', err)
    res.status(500).json({ error: 'Failed to fetch notification count' })
  }
})

/**
 * POST /api/notifications/:id/read
 * Mark a notification as read
 */
router.post('/:id/read', async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const success = await markAsRead(id, req.user!.id)
    if (!success) {
      return res.status(400).json({ error: 'Failed to mark notification as read' })
    }

    res.json({ success: true })
  } catch (err) {
    console.error('Error marking notification as read:', err)
    res.status(500).json({ error: 'Failed to mark notification as read' })
  }
})

/**
 * POST /api/notifications/read-all
 * Mark all notifications as read
 */
router.post('/read-all', async (req: Request, res: Response) => {
  try {
    const success = await markAllAsRead(req.companyId!, req.user!.id)
    if (!success) {
      return res.status(400).json({ error: 'Failed to mark all notifications as read' })
    }

    res.json({ success: true })
  } catch (err) {
    console.error('Error marking all notifications as read:', err)
    res.status(500).json({ error: 'Failed to mark all notifications as read' })
  }
})

/**
 * POST /api/notifications/:id/dismiss
 * Dismiss a notification
 */
router.post('/:id/dismiss', async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const success = await dismissNotification(id, req.user!.id)
    if (!success) {
      return res.status(400).json({ error: 'Failed to dismiss notification' })
    }

    res.json({ success: true })
  } catch (err) {
    console.error('Error dismissing notification:', err)
    res.status(500).json({ error: 'Failed to dismiss notification' })
  }
})

/**
 * GET /api/notifications/badge-counts
 * Returns counts for sidebar notification badges
 */
router.get('/badge-counts', async (req: Request, res: Response) => {
  try {
    const { supabase } = await import('../config/supabase')
    const today = new Date().toISOString().split('T')[0]

    const [offersResult, tenanciesResult] = await Promise.all([
      supabase
        .from('tenant_offers')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', req.companyId!)
        .eq('status', 'pending')
        .eq('is_v2', true),
      supabase
        .from('tenancies')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', req.companyId!)
        .in('status', ['pending', 'draft'])
        .lte('start_date', today)
    ])

    res.json({
      pending_offers: offersResult.count || 0,
      ready_tenancies: tenanciesResult.count || 0
    })
  } catch (err) {
    console.error('Error fetching badge counts:', err)
    res.status(500).json({ error: 'Failed to fetch badge counts' })
  }
})

export default router

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: any
      companyId?: string
    }
  }
}
