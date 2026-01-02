import { Request, Response, NextFunction } from 'express'
import { supabase } from '../config/supabase'

export interface AuthRequest extends Request {
  user?: any
  userRole?: string
  companyId?: string
  isAdminOverride?: boolean
  adminViewingCompanyName?: string
}

/**
 * Helper to get company ID for a request, supporting admin override.
 * Returns null if no company could be determined.
 */
export async function getCompanyIdForRequest(req: AuthRequest): Promise<string | null> {
  const userId = req.user?.id
  if (!userId) return null

  // Check for admin company override header
  const overrideCompanyId = req.headers['x-admin-company-id'] as string | undefined

  if (overrideCompanyId) {
    // Verify user is a staff admin before allowing override
    const { data: staffUser } = await supabase
      .from('staff_users')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .eq('is_admin', true)
      .single()

    if (staffUser) {
      // Verify target company exists
      const { data: targetCompany } = await supabase
        .from('companies')
        .select('id')
        .eq('id', overrideCompanyId)
        .single()

      if (targetCompany) {
        return overrideCompanyId
      }
    }
  }

  // Fall back to user's own company
  const { data: companyUsers } = await supabase
    .from('company_users')
    .select('company_id')
    .eq('user_id', userId)
    .limit(1)

  if (companyUsers && companyUsers.length > 0) {
    return companyUsers[0].company_id
  }

  return null
}

/**
 * Helper to check if user is a staff admin and apply company override if requested
 */
async function applyAdminCompanyOverride(req: AuthRequest): Promise<boolean> {
  const overrideCompanyId = req.headers['x-admin-company-id'] as string | undefined

  if (!overrideCompanyId) {
    return true // No override requested, continue normally
  }

  const userId = req.user?.id
  if (!userId) {
    return false
  }

  // Verify user is a staff admin
  const { data: staffUser, error: staffError } = await supabase
    .from('staff_users')
    .select('id, is_admin, is_active')
    .eq('user_id', userId)
    .eq('is_active', true)
    .eq('is_admin', true)
    .single()

  if (staffError || !staffUser) {
    console.log('[Auth] Non-admin user attempted company override:', userId)
    return false
  }

  // Verify target company exists
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('id')
    .eq('id', overrideCompanyId)
    .single()

  if (companyError || !company) {
    console.log('[Auth] Admin override with invalid company ID:', overrideCompanyId)
    return false
  }

  // Apply the override
  req.companyId = overrideCompanyId
  req.isAdminOverride = true
  console.log(`[Auth] Admin company override applied: ${userId} viewing ${overrideCompanyId}`)

  return true
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
 * Supports admin company override via X-Admin-Company-Id header
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
      // Check if this is a staff admin trying to view a company
      const overrideCompanyId = req.headers['x-admin-company-id'] as string | undefined
      if (overrideCompanyId) {
        const overrideApplied = await applyAdminCompanyOverride(req)
        if (overrideApplied) {
          req.userRole = 'admin' // Give admin role for viewing
          return next()
        }
      }
      return res.status(404).json({ error: 'User not associated with any company' })
    }

    if (companyUser.role !== 'owner' && companyUser.role !== 'admin') {
      // Check if this is a staff admin - they get admin access
      const overrideCompanyId = req.headers['x-admin-company-id'] as string | undefined
      if (overrideCompanyId) {
        const overrideApplied = await applyAdminCompanyOverride(req)
        if (overrideApplied) {
          req.userRole = 'admin'
          return next()
        }
      }
      return res.status(403).json({ error: 'Admin access required' })
    }

    // Store role and companyId for use in route handlers
    req.userRole = companyUser.role
    req.companyId = companyUser.company_id

    // Check for admin company override
    const overrideApplied = await applyAdminCompanyOverride(req)
    if (!overrideApplied) {
      return res.status(403).json({ error: 'Invalid company override' })
    }

    next()
  } catch (error) {
    return res.status(500).json({ error: 'Server error' })
  }
}

/**
 * Middleware to require any authenticated user who is a member of a company
 * Must be used after authenticateToken
 * Supports admin company override via X-Admin-Company-Id header
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
      // Check if this is a staff admin trying to view a company
      const overrideCompanyId = req.headers['x-admin-company-id'] as string | undefined
      if (overrideCompanyId) {
        const overrideApplied = await applyAdminCompanyOverride(req)
        if (overrideApplied) {
          req.userRole = 'admin' // Give admin role for viewing
          return next()
        }
      }
      return res.status(404).json({ error: 'User not associated with any company' })
    }

    // Store role and companyId for use in route handlers
    req.userRole = companyUser.role
    req.companyId = companyUser.company_id

    // Check for admin company override
    const overrideApplied = await applyAdminCompanyOverride(req)
    if (!overrideApplied) {
      return res.status(403).json({ error: 'Invalid company override' })
    }

    next()
  } catch (error) {
    return res.status(500).json({ error: 'Server error' })
  }
}
