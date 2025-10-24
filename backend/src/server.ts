import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import helmet from 'helmet'
import companyRoutes from './routes/company'
import invitationRoutes from './routes/invitations'
import profileRoutes from './routes/profile'
import referencesRoutes from './routes/references'
import staffRoutes from './routes/staff'
import debugRoutes from './routes/debug'
import auditLogRoutes from './routes/auditLogs'
import verificationRoutes from './routes/verification'

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
  credentials: true
}))

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
app.use('/api/staff', staffRoutes)
app.use('/api/debug', debugRoutes)
app.use('/api/audit-logs', auditLogRoutes)
app.use('/api/verification', verificationRoutes)

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
