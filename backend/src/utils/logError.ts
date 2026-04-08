import { Request } from 'express'
import { logError as writeErrorLog, sanitizeBody } from '../services/errorLogService'

/**
 * Extract client IP address from Express request.
 * Handles proxies and load balancers.
 */
function getClientIp(req: Request): string | null {
  const forwarded = req.headers['x-forwarded-for']
  if (forwarded) {
    const ips = (typeof forwarded === 'string' ? forwarded : forwarded[0]).split(',')
    return ips[0].trim()
  }
  const realIp = req.headers['x-real-ip']
  if (realIp) {
    return typeof realIp === 'string' ? realIp : realIp[0]
  }
  return req.ip || req.socket?.remoteAddress || null
}

/**
 * Log a backend error with context extracted from the Express request.
 * Fire-and-forget -- never throws.
 *
 * Usage in route catch blocks:
 *   logError(error, req)
 */
export function logError(error: any, req?: Request): void {
  const message = error?.message || String(error)
  const stackTrace = error?.stack || undefined
  const errorType = error?.constructor?.name || error?.name || undefined

  const authReq = req as any

  writeErrorLog({
    source: 'backend',
    message,
    stackTrace,
    errorType,
    userId: authReq?.user?.id || undefined,
    userEmail: authReq?.user?.email || undefined,
    companyId: authReq?.companyId || undefined,
    branchId: (req?.headers?.['x-branch-id'] as string) || undefined,
    requestMethod: req?.method || undefined,
    requestUrl: req?.originalUrl || undefined,
    requestQuery: req?.query && Object.keys(req.query).length > 0
      ? sanitizeBody(req.query)
      : undefined,
    requestBody: req?.body && Object.keys(req.body).length > 0
      ? sanitizeBody(req.body)
      : undefined,
    ipAddress: req ? getClientIp(req) || undefined : undefined,
    userAgent: (req?.headers?.['user-agent'] as string) || undefined,
  })
}
