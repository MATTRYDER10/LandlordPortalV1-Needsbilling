import { Request, Response, NextFunction } from 'express'
import { supabase } from '../config/supabase'

export interface StaffAuthRequest extends Request {
  user?: any
  staffUser?: {
    id: string
    full_name: string
  }
}

export const authenticateStaff = async (
  req: StaffAuthRequest,
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
      return res.status(403).json({ error: 'Invalid token' })
    }

    // Check if user is a staff member
    const { data: staffUser, error: staffError } = await supabase
      .from('staff_users')
      .select('id, full_name, is_active')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (staffError || !staffUser) {
      return res.status(403).json({ error: 'Access denied. Staff privileges required.' })
    }

    req.user = user
    req.staffUser = {
      id: staffUser.id,
      full_name: staffUser.full_name
    }
    next()
  } catch (error) {
    return res.status(500).json({ error: 'Server error' })
  }
}
