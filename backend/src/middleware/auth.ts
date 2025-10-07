import { Request, Response, NextFunction } from 'express'
import { supabase } from '../config/supabase'

export interface AuthRequest extends Request {
  user?: any
  userRole?: string
  companyId?: string
}

export const authenticateToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return res.status(401).json({ error: 'No token provided' })
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (error || !user) {
      return res.status(403).json({ error: 'Invalid token' })
    }

    req.user = user
    next()
  } catch (error) {
    return res.status(500).json({ error: 'Server error' })
  }
}

/**
 * Middleware to require admin role (owner or admin)
 * Must be used after authenticateToken
 */
export const requireAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    // Get user's role in their company
    const { data: companyUser, error } = await supabase
      .from('company_users')
      .select('role, company_id')
      .eq('user_id', userId)
      .single()

    if (error || !companyUser) {
      return res.status(404).json({ error: 'User not associated with any company' })
    }

    if (companyUser.role !== 'owner' && companyUser.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    // Store role and companyId for use in route handlers
    req.userRole = companyUser.role
    req.companyId = companyUser.company_id
    next()
  } catch (error) {
    return res.status(500).json({ error: 'Server error' })
  }
}

/**
 * Middleware to require any authenticated user who is a member of a company
 * Must be used after authenticateToken
 */
export const requireMember = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    // Get user's role and company
    const { data: companyUser, error } = await supabase
      .from('company_users')
      .select('role, company_id')
      .eq('user_id', userId)
      .single()

    if (error || !companyUser) {
      return res.status(404).json({ error: 'User not associated with any company' })
    }

    // Store role and companyId for use in route handlers
    req.userRole = companyUser.role
    req.companyId = companyUser.company_id
    next()
  } catch (error) {
    return res.status(500).json({ error: 'Server error' })
  }
}
