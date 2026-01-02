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

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

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
  process.env.FRONTEND_URL // Production (Railway)
].filter(Boolean) // Remove undefined values

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true)

    if (allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Company-Id'],
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

// Mount webhook routes
app.use('/api/webhooks', webhookRoutes)

// Middleware
app.use(express.json())

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

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)

  // Start background schedulers for work queue management
  startSchedulers()

  // Start property compliance scheduler
  startComplianceScheduler()
})
