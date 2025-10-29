import { Router } from 'express'
import { authenticateToken, AuthRequest } from '../middleware/auth'
import { supabase } from '../config/supabase'

const router = Router()

// Get audit log for a reference
router.get('/:referenceId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { referenceId } = req.params

    const { data: auditLog, error } = await supabase
      .from('reference_audit_log')
      .select('*')
      .eq('reference_id', referenceId)
      .order('created_at', { ascending: false })

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    // Fetch user emails for entries that have a user
    if (auditLog && auditLog.length > 0) {
      const userIds = [...new Set(auditLog.filter(a => a.created_by).map(a => a.created_by))]

      if (userIds.length > 0) {
        const { data: users } = await supabase.auth.admin.listUsers()
        const userMap = new Map(users.users.map(u => [u.id, u.email]))

        const auditLogWithUsers = auditLog.map(entry => ({
          ...entry,
          created_by_user: entry.created_by ? { email: userMap.get(entry.created_by) || 'Unknown' } : null
        }))

        return res.json(auditLogWithUsers)
      }
    }

    res.json(auditLog)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

export default router
