import { Request, Response, NextFunction } from 'express'
import { supabase } from '../config/supabase'

export interface AdminAuthRequest extends Request {
  user?: any
  adminUser?: {
    id: string
    full_name: string
    email: string
  }
}

/**
 * Middleware to authenticate admin users
 * Verifies the user is both a staff member and has admin privileges
 */
export const authenticateAdmin = async (
  req: AdminAuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return res.status(401).json({ error: 'No token provided' })
  }

  try {
    // Verify token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (error || !user) {
      console.log('[Admin Auth] Invalid token or user not found')
      return res.status(403).json({ error: 'Invalid token' })
    }

    console.log('[Admin Auth] Checking admin status for user:', user.id)

    // Check if user is a staff member with admin privileges
    const { data: adminUser, error: adminError } = await supabase
      .from('staff_users')
      .select('id, full_name, email, is_active, is_admin')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .eq('is_admin', true)
      .single()

    console.log('[Admin Auth] Staff user query result:', { adminUser, adminError })

    if (adminError || !adminUser) {
      console.log('[Admin Auth] Access denied for user:', user.id)
      return res.status(403).json({
        error: 'Access denied. Admin privileges required.'
      })
    }

    console.log('[Admin Auth] Access granted for admin user:', adminUser.full_name)

    req.user = user
    req.adminUser = {
      id: adminUser.id,
      full_name: adminUser.full_name,
      email: adminUser.email
    }
    next()
  } catch (error) {
    console.error('Admin authentication error:', error)
    return res.status(500).json({ error: 'Server error' })
  }
}
