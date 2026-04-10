import type { App, ComponentPublicInstance } from 'vue'
import type { Router } from 'vue-router'

const API_URL = import.meta.env.VITE_API_URL ?? ''

// ── Known noise patterns to ignore ──────────────────────────────────
// These are browser extension or browser-internal errors that are not
// actionable and pollute the error log.
const IGNORED_PATTERNS = [
  // Password manager / autofill extensions (LastPass, 1Password, Dashlane, etc.)
  // trying to update a form field that Vue has already removed from the DOM.
  /Object Not Found Matching Id:\d+, MethodName:\w+, ParamCount:\d+/,
]

function isIgnoredError(message: string): boolean {
  return IGNORED_PATTERNS.some(pattern => pattern.test(message))
}

// ── Rate limiting ────────────────────────────────────────────────────
const MAX_ERRORS_PER_WINDOW = 5
const RATE_LIMIT_WINDOW_MS = 10_000
const DEDUP_WINDOW_MS = 30_000

const errorTimestamps: number[] = []
const recentFingerprints = new Map<string, number>()

function isRateLimited(): boolean {
  const now = Date.now()
  // Remove old timestamps
  while (errorTimestamps.length > 0 && errorTimestamps[0] < now - RATE_LIMIT_WINDOW_MS) {
    errorTimestamps.shift()
  }
  return errorTimestamps.length >= MAX_ERRORS_PER_WINDOW
}

function isDuplicate(fingerprint: string): boolean {
  const now = Date.now()
  const lastSeen = recentFingerprints.get(fingerprint)
  if (lastSeen && now - lastSeen < DEDUP_WINDOW_MS) {
    return true
  }
  recentFingerprints.set(fingerprint, now)
  // Cleanup old entries
  for (const [key, ts] of recentFingerprints) {
    if (now - ts > DEDUP_WINDOW_MS) recentFingerprints.delete(key)
  }
  return false
}

function makeFingerprint(message: string, stack?: string): string {
  const firstLine = stack?.split('\n').find(l => l.trim().startsWith('at ')) || ''
  return `${message}:${firstLine.trim()}`
}

// ── Context gathering ────────────────────────────────────────────────
let routerRef: Router | null = null

function getRouteContext() {
  try {
    if (!routerRef) return {}
    const route = routerRef.currentRoute.value
    return {
      routeName: route.name ? String(route.name) : undefined,
      routePath: route.path,
      routeParams: Object.keys(route.params).length > 0 ? { ...route.params } : undefined,
    }
  } catch {
    return {}
  }
}

function getUserContext() {
  try {
    // Dynamic import to avoid circular deps -- auth store may not be ready
    const { useAuthStore } = require('../stores/auth')
    const store = useAuthStore()
    return {
      userId: store.user?.id || undefined,
      userEmail: store.user?.email || undefined,
      companyId: store.company?.name || undefined, // company name for context
      branchId: store.activeBranchId || undefined,
    }
  } catch {
    return {}
  }
}

function getBrowserInfo() {
  return {
    userAgent: navigator.userAgent,
    screenWidth: screen.width,
    screenHeight: screen.height,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    language: navigator.language,
    online: navigator.onLine,
  }
}

// ── Error sending ────────────────────────────────────────────────────
function sendError(payload: Record<string, any>) {
  try {
    // Only send errors in production
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') return

    const fingerprint = makeFingerprint(payload.message, payload.stackTrace)

    if (isIgnoredError(payload.message)) return
    if (isRateLimited()) return
    if (isDuplicate(fingerprint)) return

    errorTimestamps.push(Date.now())

    const body = JSON.stringify({
      ...payload,
      ...getRouteContext(),
      ...getUserContext(),
      browserInfo: getBrowserInfo(),
      appVersion: (window as any).__APP_VERSION__ || undefined,
    })

    // Use sendBeacon for reliability (survives page unload), fall back to fetch
    const url = `${API_URL}/api/error-logs`
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' })
      const sent = navigator.sendBeacon(url, blob)
      if (sent) return
    }

    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {
      // Silently fail -- error logger must never cause errors
    })
  } catch {
    // Silently fail
  }
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Manually log a frontend error from a catch block.
 *
 * Usage:
 *   import { logFrontendError } from '@/services/errorLogger'
 *   catch (err) { logFrontendError(err, { context: 'loading tenancies' }) }
 */
export function logFrontendError(
  error: Error | string,
  context?: Record<string, any>
) {
  const err = typeof error === 'string' ? new Error(error) : error
  sendError({
    message: err.message || String(error),
    stackTrace: err.stack,
    errorType: err.constructor?.name || err.name || 'Error',
    metadata: context,
  })
}

/**
 * Initialize global error handlers. Call once in main.ts after app.use(router).
 */
export function initErrorLogger(app: App, router: Router) {
  routerRef = router

  // 1. Vue component errors
  app.config.errorHandler = (
    err: unknown,
    instance: ComponentPublicInstance | null,
    info: string
  ) => {
    const error = err instanceof Error ? err : new Error(String(err))
    const componentName = instance?.$options?.name || instance?.$options?.__name || undefined

    sendError({
      message: error.message,
      stackTrace: error.stack,
      errorType: error.constructor?.name || 'VueError',
      componentName,
      metadata: { vueInfo: info },
    })

    // Also log to console so dev tools still work
    console.error('[Vue Error]', err)
  }

  // 2. Unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason instanceof Error
      ? event.reason
      : new Error(String(event.reason))

    sendError({
      message: error.message || 'Unhandled Promise Rejection',
      stackTrace: error.stack,
      errorType: 'UnhandledRejection',
    })
  })

  // 3. Uncaught JS errors
  window.onerror = (message, source, lineno, colno, error) => {
    sendError({
      message: error?.message || String(message),
      stackTrace: error?.stack,
      errorType: error?.constructor?.name || 'UncaughtError',
      metadata: {
        source,
        lineno,
        colno,
      },
    })
  }
}
