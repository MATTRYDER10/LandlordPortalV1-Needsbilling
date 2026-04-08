import { Router, Request, Response } from 'express'
import { supabase } from '../config/supabase'
import { logError as writeErrorLog, sanitizeBody } from '../services/errorLogService'
import { authenticateAdmin, AdminAuthRequest } from '../middleware/adminAuth'

const router = Router()

// ── In-memory rate limiter for frontend error ingestion ──────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_MAX = 10
const RATE_LIMIT_WINDOW_MS = 60_000

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return false
  }

  entry.count++
  return entry.count > RATE_LIMIT_MAX
}

// Periodic cleanup of stale rate limit entries
setInterval(() => {
  const now = Date.now()
  for (const [ip, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(ip)
  }
}, 60_000)

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for']
  if (forwarded) {
    const ips = (typeof forwarded === 'string' ? forwarded : forwarded[0]).split(',')
    return ips[0].trim()
  }
  const realIp = req.headers['x-real-ip']
  if (realIp) return typeof realIp === 'string' ? realIp : realIp[0]
  return req.ip || req.socket?.remoteAddress || '0.0.0.0'
}

// ── POST /api/error-logs -- Frontend error ingestion (no auth) ───────
router.post('/', (req: Request, res: Response) => {
  try {
    const ip = getClientIp(req)

    if (isRateLimited(ip)) {
      res.set('Retry-After', '60')
      return res.status(429).json({ error: 'Too many error reports. Try again later.' })
    }

    const body = req.body
    if (!body?.message) {
      return res.status(400).json({ error: 'message is required' })
    }

    // Fire and forget -- don't await
    writeErrorLog({
      source: 'frontend',
      level: body.level || 'error',
      message: String(body.message).substring(0, 5000),
      stackTrace: body.stackTrace ? String(body.stackTrace).substring(0, 10000) : undefined,
      errorType: body.errorType || undefined,
      errorCode: body.errorCode || undefined,
      userId: body.userId || undefined,
      userEmail: body.userEmail || undefined,
      companyId: body.companyId || undefined,
      branchId: body.branchId || undefined,
      routeName: body.routeName || undefined,
      routePath: body.routePath || undefined,
      routeParams: body.routeParams || undefined,
      componentName: body.componentName || undefined,
      appVersion: body.appVersion || undefined,
      browserInfo: body.browserInfo || undefined,
      ipAddress: ip,
      userAgent: req.headers['user-agent'] || undefined,
      metadata: body.metadata || undefined,
    })

    return res.status(202).json({ success: true })
  } catch (err: any) {
    console.error('[ErrorLogs] Ingestion error:', err.message)
    return res.status(500).json({ error: 'Failed to log error' })
  }
})

// ── GET /api/error-logs -- List errors (admin only) ──────────────────
router.get('/', authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50))
    const offset = (page - 1) * limit

    let query = supabase
      .from('error_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Filters
    if (req.query.source) {
      query = query.eq('source', req.query.source)
    }
    if (req.query.level) {
      query = query.eq('level', req.query.level)
    }
    if (req.query.start_date) {
      query = query.gte('created_at', req.query.start_date)
    }
    if (req.query.end_date) {
      query = query.lte('created_at', req.query.end_date)
    }
    if (req.query.search) {
      query = query.ilike('message', `%${req.query.search}%`)
    }
    if (req.query.fingerprint) {
      query = query.eq('fingerprint', req.query.fingerprint)
    }
    if (req.query.user_id) {
      query = query.eq('user_id', req.query.user_id)
    }
    if (req.query.company_id) {
      query = query.eq('company_id', req.query.company_id)
    }
    if (req.query.resolved === 'true') {
      query = query.not('resolved_at', 'is', null)
    } else if (req.query.resolved === 'false') {
      query = query.is('resolved_at', null)
    }

    const { data, error, count } = await query

    if (error) {
      console.error('[ErrorLogs] Query error:', error)
      return res.status(500).json({ error: 'Failed to fetch error logs' })
    }

    return res.json({
      data,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (err: any) {
    console.error('[ErrorLogs] List error:', err.message)
    return res.status(500).json({ error: 'Failed to fetch error logs' })
  }
})

// ── GET /api/error-logs/stats -- Summary statistics (admin only) ─────
router.get('/stats', authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
  try {
    const now = new Date()
    const day1 = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
    const day7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const day30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

    // Run counts in parallel
    const [count24h, count7d, count30d, countUnresolved, recentErrorsResult] = await Promise.all([
      supabase.from('error_logs').select('id', { count: 'exact', head: true }).gte('created_at', day1),
      supabase.from('error_logs').select('id', { count: 'exact', head: true }).gte('created_at', day7),
      supabase.from('error_logs').select('id', { count: 'exact', head: true }).gte('created_at', day30),
      supabase.from('error_logs').select('id', { count: 'exact', head: true }).is('resolved_at', null),
      supabase
        .from('error_logs')
        .select('fingerprint, message, source, level, error_type, created_at')
        .gte('created_at', day7)
        .order('created_at', { ascending: false })
        .limit(500),
    ])

    // Group recent errors by fingerprint to find top errors
    let topErrorsData: any[] = []
    const recentErrors = recentErrorsResult.data
    if (recentErrors) {
      const grouped = new Map<string, { fingerprint: string; message: string; source: string; level: string; error_type: string; count: number; latest: string }>()
      for (const err of recentErrors) {
        const existing = grouped.get(err.fingerprint)
        if (existing) {
          existing.count++
        } else {
          grouped.set(err.fingerprint, {
            fingerprint: err.fingerprint,
            message: err.message,
            source: err.source,
            level: err.level,
            error_type: err.error_type,
            count: 1,
            latest: err.created_at,
          })
        }
      }
      topErrorsData = Array.from(grouped.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
    }

    return res.json({
      totals: {
        last24h: count24h.count || 0,
        last7d: count7d.count || 0,
        last30d: count30d.count || 0,
        unresolved: countUnresolved.count || 0,
      },
      topErrors: topErrorsData || [],
    })
  } catch (err: any) {
    console.error('[ErrorLogs] Stats error:', err.message)
    return res.status(500).json({ error: 'Failed to fetch error stats' })
  }
})

// ── PATCH /api/error-logs/:id/resolve -- Mark single error resolved ──
router.patch('/:id/resolve', authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const adminUserId = req.adminUser?.id || req.user?.id

    const { error } = await supabase
      .from('error_logs')
      .update({ resolved_at: new Date().toISOString(), resolved_by: adminUserId })
      .eq('id', id)

    if (error) {
      console.error('[ErrorLogs] Resolve error:', error)
      return res.status(500).json({ error: 'Failed to resolve error' })
    }

    return res.json({ success: true })
  } catch (err: any) {
    console.error('[ErrorLogs] Resolve error:', err.message)
    return res.status(500).json({ error: 'Failed to resolve error' })
  }
})

// ── PATCH /api/error-logs/resolve-by-fingerprint -- Bulk resolve ─────
router.patch('/resolve-by-fingerprint', authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
  try {
    const { fingerprint } = req.body
    if (!fingerprint) {
      return res.status(400).json({ error: 'fingerprint is required' })
    }

    const adminUserId = req.adminUser?.id || req.user?.id

    const { error, count } = await supabase
      .from('error_logs')
      .update({ resolved_at: new Date().toISOString(), resolved_by: adminUserId })
      .eq('fingerprint', fingerprint)
      .is('resolved_at', null)

    if (error) {
      console.error('[ErrorLogs] Bulk resolve error:', error)
      return res.status(500).json({ error: 'Failed to resolve errors' })
    }

    return res.json({ success: true, resolved: count || 0 })
  } catch (err: any) {
    console.error('[ErrorLogs] Bulk resolve error:', err.message)
    return res.status(500).json({ error: 'Failed to resolve errors' })
  }
})

export default router
