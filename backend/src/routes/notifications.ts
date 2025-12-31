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

    // Get company ID
    const { data: companyUser, error: companyError } = await supabaseAdmin
      .from('company_users')
      .select('company_id')
      .eq('user_id', user.id)
      .single()

    if (companyError || !companyUser) {
      return res.status(403).json({ error: 'User not associated with a company' })
    }

    req.user = user
    req.companyId = companyUser.company_id
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
