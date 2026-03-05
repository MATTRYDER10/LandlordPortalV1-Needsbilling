import { Router } from 'express'
import { authenticateToken, AuthRequest } from '../middleware/auth'
import { supabase } from '../config/supabase'
import { createAuditLog } from '../services/auditLog'

const router = Router()

// Get user profile
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id

    const { data: { user }, error } = await supabase.auth.admin.getUserById(userId!)

    if (error || !user) {
      return res.status(404).json({ error: 'User not found' })
    }

    res.json({
      id: user.id,
      email: user.email,
      fullName: user.user_metadata?.full_name,
      phone: user.user_metadata?.phone,
      createdAt: user.created_at
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Update user profile
router.put('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    const { fullName, phone } = req.body

    // Get current user data for audit trail
    const { data: { user: oldUser } } = await supabase.auth.admin.getUserById(userId!)

    const { data, error } = await supabase.auth.admin.updateUserById(
      userId!,
      {
        user_metadata: {
          full_name: fullName,
          phone
        }
      }
    )

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    // Get user's company for audit log
    const { data: companyUser } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', userId!)
      .limit(1)

    if (companyUser && companyUser.length > 0) {
      // Track what changed
      const changes: Record<string, any> = {}
      if (oldUser?.user_metadata?.full_name !== fullName) {
        changes.fullName = { old: oldUser?.user_metadata?.full_name, new: fullName }
      }
      if (oldUser?.user_metadata?.phone !== phone) {
        changes.phone = { old: oldUser?.user_metadata?.phone, new: phone }
      }

      if (Object.keys(changes).length > 0) {
        await createAuditLog(
          {
            companyId: companyUser[0].company_id,
            userId: userId!,
            actionType: 'user.profile_updated',
            resourceType: 'profile',
            resourceId: userId!,
            description: `Updated profile: ${Object.keys(changes).join(', ')}`,
            metadata: { changes }
          },
          req
        )
      }
    }

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: data.user.id,
        email: data.user.email,
        fullName: data.user.user_metadata?.full_name,
        phone: data.user.user_metadata?.phone
      }
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Check if user has staff privileges (returns 200 with isStaff boolean, never 403)
router.get('/check-staff', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id

    const { data: staffUser } = await supabase
      .from('staff_users')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single()

    res.json({ isStaff: !!staffUser })
  } catch (error: any) {
    // Return false on any error, don't fail
    res.json({ isStaff: false })
  }
})

// Check if user has admin privileges (returns 200 with isAdmin boolean, never 403)
router.get('/check-admin', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id

    const { data: staffUser } = await supabase
      .from('staff_users')
      .select('id, is_admin')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single()

    res.json({ isAdmin: !!staffUser?.is_admin })
  } catch (error: any) {
    res.json({ isAdmin: false })
  }
})

export default router
