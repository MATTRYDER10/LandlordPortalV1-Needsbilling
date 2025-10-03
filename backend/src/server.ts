import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import companyRoutes from './routes/company'
import invitationRoutes from './routes/invitations'
import profileRoutes from './routes/profile'
import referencesRoutes from './routes/references'
import staffRoutes from './routes/staff'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

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

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
