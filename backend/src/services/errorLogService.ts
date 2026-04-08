import crypto from 'crypto'
import { supabase } from '../config/supabase'

export interface ErrorLogPayload {
  source: 'frontend' | 'backend'
  level?: 'error' | 'warn' | 'fatal'
  message: string
  stackTrace?: string
  errorType?: string
  errorCode?: string
  userId?: string
  userEmail?: string
  companyId?: string
  branchId?: string
  routeName?: string
  routePath?: string
  routeParams?: Record<string, any>
  componentName?: string
  appVersion?: string
  browserInfo?: Record<string, any>
  requestMethod?: string
  requestUrl?: string
  requestQuery?: Record<string, any>
  requestBody?: Record<string, any>
  responseStatusCode?: number
  ipAddress?: string
  userAgent?: string
  metadata?: Record<string, any>
}

const SENSITIVE_KEYS = new Set([
  'password', 'passwd', 'pass',
  'token', 'access_token', 'refresh_token',
  'secret', 'api_key', 'apikey',
  'authorization', 'auth',
  'credit_card', 'card_number', 'cvv', 'cvc',
  'ssn', 'national_insurance', 'sort_code', 'account_number',
])

/**
 * Recursively sanitize an object by redacting sensitive fields
 */
export function sanitizeBody(obj: any, depth = 0): any {
  if (depth > 10) return '[MAX_DEPTH]'
  if (obj === null || obj === undefined) return obj
  if (typeof obj === 'string') return obj.length > 1000 ? obj.substring(0, 1000) + '...[truncated]' : obj
  if (typeof obj !== 'object') return obj

  if (Array.isArray(obj)) {
    return obj.slice(0, 20).map(item => sanitizeBody(item, depth + 1))
  }

  const sanitized: Record<string, any> = {}
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase()
    if (SENSITIVE_KEYS.has(lowerKey) || lowerKey.endsWith('_encrypted')) {
      sanitized[key] = '[REDACTED]'
    } else {
      sanitized[key] = sanitizeBody(value, depth + 1)
    }
  }
  return sanitized
}

/**
 * Generate a fingerprint hash for grouping identical errors
 */
export function generateFingerprint(
  source: string,
  errorType: string | undefined,
  message: string,
  stackTrace: string | undefined
): string {
  const firstStackLine = stackTrace?.split('\n').find(line => line.trim().startsWith('at ')) || ''
  const input = `${source}:${errorType || ''}:${message}:${firstStackLine.trim()}`
  return crypto.createHash('sha256').update(input).digest('hex').substring(0, 64)
}

/**
 * Log an error to the error_logs table.
 * Fire-and-forget -- never throws.
 */
export async function logError(payload: ErrorLogPayload): Promise<void> {
  try {
    const fingerprint = generateFingerprint(
      payload.source,
      payload.errorType,
      payload.message,
      payload.stackTrace
    )

    const { error } = await supabase
      .from('error_logs')
      .insert({
        source: payload.source,
        level: payload.level || 'error',
        message: payload.message,
        stack_trace: payload.stackTrace || null,
        error_type: payload.errorType || null,
        error_code: payload.errorCode || null,
        user_id: payload.userId || null,
        user_email: payload.userEmail || null,
        company_id: payload.companyId || null,
        branch_id: payload.branchId || null,
        route_name: payload.routeName || null,
        route_path: payload.routePath || null,
        route_params: payload.routeParams || null,
        component_name: payload.componentName || null,
        app_version: payload.appVersion || null,
        browser_info: payload.browserInfo || null,
        request_method: payload.requestMethod || null,
        request_url: payload.requestUrl || null,
        request_query: payload.requestQuery || null,
        request_body: payload.requestBody ? sanitizeBody(payload.requestBody) : null,
        response_status_code: payload.responseStatusCode || null,
        ip_address: payload.ipAddress || null,
        user_agent: payload.userAgent || null,
        fingerprint,
        metadata: payload.metadata || null,
      })

    if (error) {
      console.error('[ErrorLogService] Failed to write error log:', error.message)
    }
  } catch (err: any) {
    console.error('[ErrorLogService] Failed to write error log:', err.message)
  }
}
