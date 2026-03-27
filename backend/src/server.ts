import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import helmet from 'helmet'
import companyRoutes from './routes/company'
import invitationRoutes from './routes/invitations'
import profileRoutes from './routes/profile'
import referencesRoutes from './routes/references'
import guarantorReferencesRoutes from './routes/guarantor-references'
import rtrRoutes from './routes/rtr'
import staffRoutes from './routes/staff'
import debugRoutes from './routes/debug'
import auditLogRoutes from './routes/auditLogs'
import verificationRoutes from './routes/verification'
import referenceNotesRoutes from './routes/reference-notes'
import referenceAuditLogRoutes from './routes/reference-audit-log'
import offerNotesRoutes from './routes/offer-notes'
import offerAuditLogRoutes from './routes/offer-audit-log'
import agreementsRoutes from './routes/agreements'
import billingRoutes from './routes/billing'
import webhookRoutes from './routes/webhooks'
import onboardingRoutes from './routes/onboarding'
import workQueueRoutes from './routes/work-queue'
import contactAttemptsRoutes from './routes/contact-attempts'
import verificationStepsRoutes from './routes/verification-steps'
import verifyRoutes from './routes/verify'
import chaseRoutes from './routes/chase'
import landlordsRoutes from './routes/landlords'
import { startSchedulers } from './services/workQueueScheduler'
import { startComplianceScheduler } from './services/propertyComplianceScheduler'
import { startRentIncreaseScheduler } from './services/rentIncreaseScheduler'
import tenantOffersRoutes from './routes/tenant-offers'
import googlePlaces from './routes/google-places'
import adminRoutes from './routes/admin'
import adminReportsRoutes from './routes/adminReports'
import agreementSigningRoutes from './routes/agreementSigning'
import tenanciesRoutes from './routes/tenancies'
import vapiRoutes from './routes/vapi'
import emailIssuesRoutes from './routes/email-issues'
import propertiesRoutes from './routes/properties'
import notificationsRoutes from './routes/notifications'
import legalRoutes from './routes/legal'
import tdsSettingsRoutes from './routes/tds-settings'
import tdsRoutes from './routes/tds'
import tenantChangeRoutes from './routes/tenant-change'
import repositSettingsRoutes from './routes/reposit-settings'
import repositRoutes from './routes/reposit'
import reviewLinksRoutes from './routes/review-links'
import mydepositsSettingsRoutes from './routes/mydeposits-settings'
import mydepositsRoutes from './routes/mydeposits'
import supportRoutes from './routes/support'
import apex27SettingsRoutes from './routes/apex27-settings'
import apex27SyncRoutes from './routes/apex27-sync'
import igSettingsRoutes from './routes/ig-settings'
import igRoutes from './routes/ig'
import igWebhooksRoutes from './routes/ig-webhooks'

// V2 Reference System Routes
import { referencesRouter as v2ReferencesRouter, sectionsRouter as v2SectionsRouter, chaseRouter as v2ChaseRouter, finalReviewRouter as v2FinalReviewRouter, tenantFormRouter as v2TenantFormRouter, guarantorFormRouter as v2GuarantorFormRouter, refereeFormsRouter as v2RefereeFormsRouter, reportsRouter as v2ReportsRouter, adminRouter as v2AdminRouter, verifyRouter as v2VerifyRouter, offersRouter as v2OffersRouter, mobileCaptureRouter as v2MobileCaptureRouter, uploadLinkRouter as v2UploadLinkRouter, groupAssessmentRouter as v2GroupAssessmentRouter } from './routes/v2'
import { startChaseSchedulerV2 } from './services/v2'
import { startDepositCertificateScheduler } from './services/depositCertificateScheduler'

dotenv.config()

const app = express()
const PORT = parseInt(process.env.PORT || '3001', 10)

// Trust proxy when behind a reverse proxy (Railway, Cloudflare, etc.)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1)
}

// HTTPS Enforcement in production
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      res.redirect(`https://${req.header('host')}${req.url}`)
    } else {
      next()
    }
  })
}

// Security Headers - Must come first
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  frameguard: {
    action: 'deny'
  },
  noSniff: true,
  xssFilter: true,
  hidePoweredBy: true
}))

// CORS Configuration
const allowedOrigins = [
  'http://localhost:5173', // Local development
  'http://localhost:5174', // Local development (alternate port)
  'http://localhost:5180', // Local development (alternate port)
  'http://192.168.1.81:5173', // Local network access
  'http://192.168.1.81:5174', // Local network access (alternate port)
  'http://192.168.1.190:5173', // Local network access
  'http://192.168.1.190:5174', // Local network access (alternate port)
  'https://app.propertygoose.co.uk', // Production
  process.env.FRONTEND_URL // Production (Railway)
].filter(Boolean) // Remove undefined values

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true)

    // Allow ngrok tunnels for testing
    if (origin.endsWith('.ngrok-free.dev') || origin.endsWith('.ngrok.io') || origin.endsWith('.ngrok.app') || origin.endsWith('.ngrok-free.app') || origin.endsWith('.loca.lt')) {
      return callback(null, true)
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Company-Id', 'X-Branch-Id'],
  exposedHeaders: ['Content-Disposition'] // Allow frontend to read this header
}))

// IMPORTANT: Webhook routes require special body parsing
// These must come BEFORE express.json() middleware

// Stripe webhook needs raw body for signature verification
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }))

// Twilio webhook sends URL-encoded data
app.use('/api/webhooks/twilio', express.urlencoded({ extended: false }))

// VAPI webhook sends JSON data
app.use('/api/webhooks/vapi', express.json())

// Resend webhook needs raw body for signature verification + JSON parsing
app.use('/api/webhooks/resend', express.json({
  verify: (req: any, res, buf) => {
    req.rawBody = buf.toString('utf8')
  }
}))

// Reposit webhook sends JSON data
app.use('/api/webhooks/reposit', express.json())

// IG webhooks need raw body for HMAC signature verification + JSON parsing
app.use('/api/integrations/ig', express.json({
  verify: (req: any, _res, buf) => {
    req.rawBody = buf.toString('utf8')
  }
}))

// Mount webhook routes
app.use('/api/webhooks', webhookRoutes)

// Middleware - 50mb limit to support 25MB file uploads (base64 encoded)
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ limit: '50mb', extended: true }))

// Health check route
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'PropertyGoose API is running' })
})

// API Routes
app.use('/api/company', companyRoutes)
app.use('/api/invitations', invitationRoutes)
app.use('/api/profile', profileRoutes)
app.use('/api/references', referencesRoutes)
app.use('/api/google-places', googlePlaces)
app.use('/api/guarantor-references', guarantorReferencesRoutes)
app.use('/api/rtr', rtrRoutes)
app.use('/api/staff', staffRoutes)
app.use('/api/debug', debugRoutes)
app.use('/api/audit-logs', auditLogRoutes)
app.use('/api/verification', verificationRoutes)
app.use('/api/reference-notes', referenceNotesRoutes)
app.use('/api/reference-audit-log', referenceAuditLogRoutes)
app.use('/api/offer-notes', offerNotesRoutes)
app.use('/api/offer-audit-log', offerAuditLogRoutes)
app.use('/api/agreements', agreementsRoutes)
app.use('/api/billing', billingRoutes)
app.use('/api/onboarding', onboardingRoutes)
app.use('/api/work-queue', workQueueRoutes)
app.use('/api/contact-attempts', contactAttemptsRoutes)
app.use('/api/verification-steps', verificationStepsRoutes)
app.use('/api/verify', verifyRoutes)
app.use('/api/chase', chaseRoutes)
app.use('/api/vapi', vapiRoutes)
app.use('/api/landlords', landlordsRoutes)
app.use('/api/tenant-offers', tenantOffersRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/admin/reports', adminReportsRoutes)
app.use('/api/signing', agreementSigningRoutes) // Public signing routes (magic link authenticated)
app.use('/api/tenancies', tenanciesRoutes)
app.use('/api/email-issues', emailIssuesRoutes)
app.use('/api/properties', propertiesRoutes)
app.use('/api/notifications', notificationsRoutes)
app.use('/api/legal', legalRoutes)
app.use('/api/settings/tds', tdsSettingsRoutes)
app.use('/api/tds', tdsRoutes)
app.use('/api/tenant-change', tenantChangeRoutes)
app.use('/api/settings/reposit', repositSettingsRoutes)
app.use('/api/reposit', repositRoutes)
app.use('/api/review-links', reviewLinksRoutes)
app.use('/api/settings/mydeposits', mydepositsSettingsRoutes)
app.use('/api/mydeposits', mydepositsRoutes)
app.use('/api/support', supportRoutes)
app.use('/api/settings/apex27', apex27SettingsRoutes)
app.use('/api/apex27', apex27SyncRoutes)
app.use('/api/settings/ig', igSettingsRoutes)
app.use('/api/ig', igRoutes)
app.use('/api/integrations/ig', igWebhooksRoutes)

// V2 Reference System Routes (new section-based verification)
app.use('/api/v2/references', v2ReferencesRouter)
app.use('/api/v2/staff/sections', v2SectionsRouter)
app.use('/api/v2/staff/chase', v2ChaseRouter)
app.use('/api/v2/staff/final-review', v2FinalReviewRouter)
// Frontend-compatible route aliases (without /staff/ prefix)
app.use('/api/v2/sections', v2SectionsRouter)
app.use('/api/v2/chase', v2ChaseRouter)
app.use('/api/v2/final-review', v2FinalReviewRouter)
app.use('/api/v2/tenant-form', v2TenantFormRouter)
app.use('/api/v2/guarantor-form', v2GuarantorFormRouter)
app.use('/api/v2', v2RefereeFormsRouter)
app.use('/api/v2/reports', v2ReportsRouter)
app.use('/api/v2/admin', v2AdminRouter)
app.use('/api/v2/verify', v2VerifyRouter)
app.use('/api/v2/offers', v2OffersRouter)
app.use('/api/v2/mobile-capture', v2MobileCaptureRouter)
app.use('/api/v2/upload-link', v2UploadLinkRouter)
app.use('/api/v2/group-assessment', v2GroupAssessmentRouter)
app.use('/api/v2/staff/group-assessment', v2GroupAssessmentRouter)

// Start server - listen on all interfaces for local network access
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT} (accessible on local network)`)

  // Only run schedulers in production — prevents duplicate emails from dev servers
  if (process.env.NODE_ENV === 'production') {
    startSchedulers()
    startComplianceScheduler()
    startRentIncreaseScheduler()
    startChaseSchedulerV2()
    startDepositCertificateScheduler()
    console.log('[Scheduler] All background schedulers started (production)')
  } else {
    console.log('[Scheduler] Skipping background schedulers (non-production)')
  }
})
