import { Router } from 'express'
import { authenticateToken, AuthRequest } from '../middleware/auth'
import { supabase } from '../config/supabase'

const router = Router()

// Get audit log for an offer
router.get('/:offerId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { offerId } = req.params
    console.log('[offer-audit-log] GET request for offerId:', offerId, 'user:', req.user?.id)

    const { data: auditLogs, error } = await supabase
      .from('offer_audit_log')
      .select('*')
      .eq('offer_id', offerId)
      .order('created_at', { ascending: false })

    if (error) {
      console.log('[offer-audit-log] Supabase error:', error)
      return res.status(400).json({ error: error.message })
    }

    console.log('[offer-audit-log] Found', auditLogs?.length || 0, 'audit entries')

    // Fetch user emails for each audit entry
    if (auditLogs && auditLogs.length > 0) {
      const userIds = [...new Set(auditLogs.filter(a => a.created_by).map(a => a.created_by))]

      let userMap = new Map()
      if (userIds.length > 0) {
        const { data: users } = await supabase.auth.admin.listUsers()
        userMap = new Map(users.users.map(u => [u.id, u.email]))
      }

      const auditLogsWithUsers = auditLogs.map(entry => ({
        ...entry,
        created_by_user: entry.created_by
          ? { email: userMap.get(entry.created_by) || 'Unknown' }
          : { email: 'System' }
      }))

      return res.json(auditLogsWithUsers)
    }

    res.json(auditLogs)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

export default router
