import { Router } from 'express'
import { authenticateToken, AuthRequest } from '../middleware/auth'
import { supabase } from '../config/supabase'
import multer from 'multer'
import crypto from 'crypto'

const router = Router()

// Configure multer for logo uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Invalid file type. Only PNG, JPG, and WEBP are allowed.'))
    }
  }
})

// Get user's company
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id

    // Get company via company_users table
    const { data: companyUser, error: companyUserError } = await supabase
      .from('company_users')
      .select('company_id, role, companies(*)')
      .eq('user_id', userId)
      .single()

    if (companyUserError) {
      return res.status(404).json({ error: 'Company not found' })
    }

    res.json({
      company: companyUser.companies,
      role: companyUser.role
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Upload company logo
router.post('/logo', authenticateToken, upload.single('logo'), async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    const file = req.file

    if (!file) {
      return res.status(400).json({ error: 'No file provided' })
    }

    // Get user's company
    const { data: companyUser } = await supabase
      .from('company_users')
      .select('company_id, role')
      .eq('user_id', userId)
      .single()

    if (!companyUser) {
      return res.status(404).json({ error: 'Company not found' })
    }

    // Check if user is owner or admin
    if (companyUser.role !== 'owner' && companyUser.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' })
    }

    // Generate unique filename
    const fileExt = file.originalname.split('.').pop()
    const fileName = `company-logos/${companyUser.company_id}/${Date.now()}_${crypto.randomBytes(8).toString('hex')}.${fileExt}`

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('company-assets')
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: false
      })

    if (uploadError) {
      return res.status(400).json({ error: uploadError.message })
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('company-assets')
      .getPublicUrl(fileName)

    res.json({ logo_url: publicUrl })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Update company
router.put('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    const { name, address, city, postcode, phone, website, logo_url, primary_color, button_color } = req.body

    // Get user's company
    const { data: companyUser } = await supabase
      .from('company_users')
      .select('company_id, role')
      .eq('user_id', userId)
      .single()

    if (!companyUser) {
      return res.status(404).json({ error: 'Company not found' })
    }

    // Check if user is owner or admin
    if (companyUser.role !== 'owner' && companyUser.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' })
    }

    // Update company
    const { data, error } = await supabase
      .from('companies')
      .update({
        name,
        address,
        city,
        postcode,
        phone,
        website,
        logo_url,
        primary_color,
        button_color,
        updated_at: new Date().toISOString()
      })
      .eq('id', companyUser.company_id)
      .select()
      .single()

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    res.json({ company: data })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Get company members
router.get('/members', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id

    // Get user's company
    const { data: companyUser } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', userId)
      .single()

    if (!companyUser) {
      return res.status(404).json({ error: 'Company not found' })
    }

    // Get all members of the company
    const { data: members, error } = await supabase
      .from('company_users')
      .select(`
        id,
        role,
        created_at,
        user_id
      `)
      .eq('company_id', companyUser.company_id)

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    // Get user details from auth.users
    const userIds = members?.map(m => m.user_id) || []
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers()

    if (usersError) {
      return res.status(400).json({ error: usersError.message })
    }

    // Combine the data
    const membersWithDetails = members?.map(member => {
      const user = users.find(u => u.id === member.user_id)
      return {
        id: member.id,
        user_id: member.user_id,
        email: user?.email,
        name: user?.user_metadata?.full_name,
        role: member.role,
        joined: member.created_at
      }
    })

    res.json({ members: membersWithDetails })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Remove member from company
router.delete('/members/:userId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const currentUserId = req.user?.id
    const targetUserId = req.params.userId

    // Get current user's company and role
    const { data: currentUserCompany } = await supabase
      .from('company_users')
      .select('company_id, role')
      .eq('user_id', currentUserId)
      .single()

    if (!currentUserCompany) {
      return res.status(404).json({ error: 'Company not found' })
    }

    // Check if user is owner or admin
    if (currentUserCompany.role !== 'owner' && currentUserCompany.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' })
    }

    // Get target user's role
    const { data: targetUser } = await supabase
      .from('company_users')
      .select('role')
      .eq('user_id', targetUserId)
      .eq('company_id', currentUserCompany.company_id)
      .single()

    // Cannot remove owner
    if (targetUser?.role === 'owner') {
      return res.status(403).json({ error: 'Cannot remove company owner' })
    }

    // Remove user from company
    const { error } = await supabase
      .from('company_users')
      .delete()
      .eq('user_id', targetUserId)
      .eq('company_id', currentUserCompany.company_id)

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    res.json({ message: 'Member removed successfully' })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

export default router
