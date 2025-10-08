import { Router } from 'express'
import { authenticateToken, AuthRequest } from '../middleware/auth'
import { supabase } from '../config/supabase'
import multer from 'multer'
import crypto from 'crypto'
import { createAuditLog, formatUserName } from '../services/auditLog'
import { encrypt, decrypt } from '../services/encryption'

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

    // Get company via company_users table (use limit(1) to handle duplicates)
    const { data: companyUsers, error: companyUserError } = await supabase
      .from('company_users')
      .select('company_id, role, companies(*)')
      .eq('user_id', userId)
      .limit(1)

    if (companyUserError || !companyUsers || companyUsers.length === 0) {
      console.error('Company lookup error for user', userId, ':', companyUserError)
      return res.status(404).json({
        error: 'Company not found',
        debug: {
          userId,
          errorMessage: companyUserError?.message
        }
      })
    }

    const companyUser = companyUsers[0]

    // Decrypt company name
    const company = companyUser.companies ? {
      ...companyUser.companies,
      name: decrypt((companyUser.companies as any).name_encrypted)
    } : null

    res.json({
      company,
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

    // Audit log
    await createAuditLog(
      {
        companyId: companyUser.company_id,
        userId: userId!,
        actionType: 'company.logo_uploaded',
        resourceType: 'company',
        resourceId: companyUser.company_id,
        description: 'Updated company logo',
        metadata: { fileName }
      },
      req
    )

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

    // Get current company data for audit trail
    const { data: oldCompany } = await supabase
      .from('companies')
      .select('*')
      .eq('id', companyUser.company_id)
      .single()

    // Update company
    const { data, error } = await supabase
      .from('companies')
      .update({
        name_encrypted: encrypt(name),
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

    // Track what changed for audit log
    const changes: Record<string, any> = {}
    const fields = ['address', 'city', 'postcode', 'phone', 'website', 'logo_url', 'primary_color', 'button_color']
    fields.forEach(field => {
      if (oldCompany && data[field] !== oldCompany[field]) {
        changes[field] = { old: oldCompany[field], new: data[field] }
      }
    })

    // Handle encrypted name field separately
    if (oldCompany && data.name_encrypted !== oldCompany.name_encrypted) {
      changes['name'] = {
        old: oldCompany.name_encrypted ? decrypt(oldCompany.name_encrypted) : null,
        new: data.name_encrypted ? decrypt(data.name_encrypted) : null
      }
    }

    // Audit log
    if (Object.keys(changes).length > 0) {
      const changedFields = Object.keys(changes).join(', ')
      await createAuditLog(
        {
          companyId: companyUser.company_id,
          userId: userId!,
          actionType: 'company.updated',
          resourceType: 'company',
          resourceId: companyUser.company_id,
          description: `Updated company details: ${changedFields}`,
          metadata: { changes }
        },
        req
      )
    }

    // Decrypt company name for response
    const decryptedCompany = {
      ...data,
      name: decrypt(data.name_encrypted)
    }

    res.json({ company: decryptedCompany })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Get company members (all users can view the team)
router.get('/members', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id

    // Get user's company (use limit(1) to handle duplicates)
    const { data: companyUsers } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', userId)
      .limit(1)

    if (!companyUsers || companyUsers.length === 0) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const companyUser = companyUsers[0]

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

    // Get current user's company and role (use limit(1) to handle duplicates)
    const { data: currentUserCompanies } = await supabase
      .from('company_users')
      .select('company_id, role')
      .eq('user_id', currentUserId)
      .limit(1)

    if (!currentUserCompanies || currentUserCompanies.length === 0) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const currentUserCompany = currentUserCompanies[0]

    // Check if user is owner or admin
    if (currentUserCompany.role !== 'owner' && currentUserCompany.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' })
    }

    // Get target user's roles (there might be duplicates)
    const { data: targetUsers } = await supabase
      .from('company_users')
      .select('role')
      .eq('user_id', targetUserId)
      .eq('company_id', currentUserCompany.company_id)

    // Cannot remove owner
    if (targetUsers && targetUsers.some(u => u.role === 'owner')) {
      return res.status(403).json({ error: 'Cannot remove company owner' })
    }

    // Get target user details for audit log
    const { data: { user: targetUser } } = await supabase.auth.admin.getUserById(targetUserId)
    const targetUserName = formatUserName(targetUser)
    const targetUserRole = targetUsers && targetUsers.length > 0 ? targetUsers[0].role : 'member'

    // Remove ALL entries for this user from company (handles duplicates)
    const { error } = await supabase
      .from('company_users')
      .delete()
      .eq('user_id', targetUserId)
      .eq('company_id', currentUserCompany.company_id)

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    // Check if user belongs to any other companies
    const { data: otherCompanies } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', targetUserId)

    // If user doesn't belong to any other companies, delete from Supabase Auth
    if (!otherCompanies || otherCompanies.length === 0) {
      const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(targetUserId)

      if (deleteAuthError) {
        console.error('Failed to delete user from auth:', deleteAuthError)
        // Don't fail the request if auth deletion fails - user is already removed from company
      }
    }

    // Audit log
    await createAuditLog(
      {
        companyId: currentUserCompany.company_id,
        userId: currentUserId!,
        actionType: 'user.removed',
        resourceType: 'user',
        resourceId: targetUserId,
        description: `Removed ${targetUserName} from company`,
        metadata: {
          targetUserEmail: targetUser?.email,
          targetUserName,
          role: targetUserRole,
          deletedFromAuth: !otherCompanies || otherCompanies.length === 0
        }
      },
      req
    )

    res.json({ message: 'Member removed successfully' })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

export default router
