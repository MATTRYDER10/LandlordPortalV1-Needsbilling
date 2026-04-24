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

  // Check for X-Branch-Id header (user selecting which branch to use)
  const branchId = req.headers['x-branch-id'] as string | undefined
  if (branchId) {
    // Verify user belongs to this branch
    const { data: branchMembership } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', userId)
      .eq('company_id', branchId)
      .limit(1)

    if (branchMembership && branchMembership.length > 0) {
      return branchId
    }
    // If user doesn't belong to this branch, fall through to default
  }

  // Fall back to user's own company (ordered by created_at for deterministic results)
  const { data: companyUsers } = await supabase
    .from('company_users')
    .select('company_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)

  if (companyUsers && companyUsers.length > 0) {
    return companyUsers[0].company_id
  }

  return null
}

/**
 * Resolve the correct company ID for a tenancy, even when branch header is missing/wrong.
 * First tries the standard branch-aware resolution. If the tenancy doesn't belong to that
 * company, falls back to finding the tenancy's actual company and verifying user membership.
 * This prevents "Tenancy not found" errors for multi-branch users.
 */
export async function resolveCompanyForTenancy(req: AuthRequest, tenancyId: string): Promise<string | null> {
  const userId = req.user?.id
  if (!userId) return null

  // Standard branch-aware resolution
  const companyId = await getCompanyIdForRequest(req)
  if (companyId) {
    const { data } = await supabase
      .from('tenancies')
      .select('id')
      .eq('id', tenancyId)
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .maybeSingle()

    if (data) return companyId
  }

  // Branch mismatch — find the tenancy's actual company and verify user has access
  const { data: tenancy } = await supabase
    .from('tenancies')
    .select('company_id')
    .eq('id', tenancyId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!tenancy) return null

  const { data: membership } = await supabase
    .from('company_users')
    .select('company_id')
    .eq('user_id', userId)
    .eq('company_id', tenancy.company_id)
    .maybeSingle()

  if (!membership) return null

  console.warn(`[Auth] Branch mismatch resolved for tenancy ${tenancyId}: header branch=${companyId}, actual=${tenancy.company_id}, user=${userId}`)
  return tenancy.company_id
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
  let token = authHeader && authHeader.split(' ')[1]

  // Fallback to query parameter for Safari-friendly downloads
  if (!token && req.query.token) {
    token = req.query.token as string
  }

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

    // Check for X-Branch-Id header (user selecting which branch to use)
    const branchId = req.headers['x-branch-id'] as string | undefined

    let companyUser: { role: string; company_id: string } | null = null

    if (branchId) {
      // Verify user belongs to this branch
      const { data: branchMembership, error } = await supabase
        .from('company_users')
        .select('role, company_id')
        .eq('user_id', userId)
        .eq('company_id', branchId)
        .single()

      if (!error && branchMembership) {
        companyUser = branchMembership
      }
    }

    // Fall back to first company if no branch specified or branch not found
    if (!companyUser) {
      const { data: companyUsers } = await supabase
        .from('company_users')
        .select('role, company_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(1)

      if (!companyUsers || companyUsers.length === 0) {
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
      companyUser = companyUsers[0]
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

    // Check for X-Branch-Id header (user selecting which branch to use)
    const branchId = req.headers['x-branch-id'] as string | undefined

    let companyUser: { role: string; company_id: string } | null = null

    if (branchId) {
      // Verify user belongs to this branch
      const { data: branchMembership, error } = await supabase
        .from('company_users')
        .select('role, company_id')
        .eq('user_id', userId)
        .eq('company_id', branchId)
        .single()

      if (!error && branchMembership) {
        companyUser = branchMembership
      }
    }

    // Fall back to first company if no branch specified or branch not found
    if (!companyUser) {
      const { data: companyUsers } = await supabase
        .from('company_users')
        .select('role, company_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(1)

      if (!companyUsers || companyUsers.length === 0) {
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
      companyUser = companyUsers[0]
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
 * Middleware that accepts both agent (regular user) and staff authentication
 * Used for endpoints that staff need to access but also agents can use
 */
export interface DualAuthRequest extends AuthRequest {
  staffUser?: {
    id: string
    full_name: string
  }
  isStaff?: boolean
}

export const authenticateTokenOrStaff = async (
  req: DualAuthRequest,
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

    req.user = user

    // Check if user is staff
    const { data: staffUser } = await supabase
      .from('staff_users')
      .select('id, full_name, is_active')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (staffUser) {
      // Staff authentication
      req.isStaff = true
      req.staffUser = {
        id: staffUser.id,
        full_name: staffUser.full_name
      }
      return next()
    }

    // Not staff, must be a regular user (agent)
    // Check if they belong to a company
    const { data: companyUsers } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', user.id)
      .limit(1)

    if (!companyUsers || companyUsers.length === 0) {
      return res.status(403).json({ error: 'Access denied. User must be staff or belong to a company.' })
    }

    req.isStaff = false
    next()
  } catch (error) {
    return res.status(500).json({ error: 'Server error' })
  }
}
