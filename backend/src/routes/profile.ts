import { Router } from 'express'
import { authenticateToken, AuthRequest } from '../middleware/auth'
import { supabase } from '../config/supabase'

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

export default router
