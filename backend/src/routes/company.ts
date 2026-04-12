import { Router } from 'express'
import { authenticateToken, AuthRequest, getCompanyIdForRequest } from '../middleware/auth'
import { supabase } from '../config/supabase'
import multer from 'multer'
import crypto from 'crypto'
import { createAuditLog, formatUserName } from '../services/auditLog'
import { encrypt, decrypt } from '../services/encryption'
import { DEFAULT_BRANDING } from '../config/colors'
import { sendEmail } from '../services/emailService'

const router = Router()

/**
 * POST /api/company/rentgoose-interest
 * Records that a company is interested in RentGoose and emails info@propertygoose.co.uk
 */
router.post('/rentgoose-interest', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: 'Not authenticated' })

    // Get user's company
    const { data: companyUser } = await supabase
      .from('company_users')
      .select('company_id, role, companies(id, name_encrypted, email_encrypted, phone_encrypted)')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle()

    if (!companyUser) return res.status(404).json({ error: 'Company not found' })

    const company = companyUser.companies as any
    const companyName = company?.name_encrypted ? decrypt(company.name_encrypted) || 'Unknown' : 'Unknown'
    const companyEmail = company?.email_encrypted ? decrypt(company.email_encrypted) || '' : ''
    const companyPhone = company?.phone_encrypted ? decrypt(company.phone_encrypted) || '' : ''

    // Get user details
    const { data: { user } } = await supabase.auth.admin.getUserById(userId)
    const userEmail = user?.email || ''
    const userName = (user?.user_metadata?.full_name || user?.user_metadata?.name || '') as string

    const subject = `RentGoose Interest — ${companyName}`
    const html = `
      <h2>RentGoose Interest Request</h2>
      <p>A user has expressed interest in enabling RentGoose for their company. Please arrange a call to discuss.</p>
      <h3>Company</h3>
      <ul>
        <li><strong>Name:</strong> ${companyName}</li>
        <li><strong>Email:</strong> ${companyEmail}</li>
        <li><strong>Phone:</strong> ${companyPhone}</li>
        <li><strong>Company ID:</strong> ${company?.id || ''}</li>
      </ul>
      <h3>Requested by</h3>
      <ul>
        <li><strong>Name:</strong> ${userName || '(not set)'}</li>
        <li><strong>Email:</strong> ${userEmail}</li>
        <li><strong>Role:</strong> ${companyUser.role}</li>
      </ul>
      <p style="margin-top: 24px;"><em>Sent from PropertyGoose RentGoose interest button.</em></p>
    `

    try {
      await sendEmail({
        to: 'info@propertygoose.co.uk',
        subject,
        html,
        replyTo: userEmail || undefined,
      })
    } catch (emailErr) {
      console.error('Failed to send RentGoose interest email:', emailErr)
      return res.status(500).json({ error: 'Failed to send interest email' })
    }

    res.json({ success: true })
  } catch (err: any) {
    console.error('Error processing RentGoose interest:', err)
    res.status(500).json({ error: 'Failed to process request' })
  }
})

// Get all branches (companies) for the authenticated user
router.get('/branches', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id

    // Get all companies user belongs to
    const { data: companyUsers, error: companyUserError } = await supabase
      .from('company_users')
      .select('company_id, role, companies(id, name_encrypted, logo_url)')
      .eq('user_id', userId)

    if (companyUserError) {
      return res.status(400).json({ error: companyUserError.message })
    }

    if (!companyUsers || companyUsers.length === 0) {
      return res.json({ branches: [] })
    }

    const branches = companyUsers.map(cu => ({
      id: cu.company_id,
      name: decrypt((cu.companies as any).name_encrypted),
      role: cu.role,
      logoUrl: (cu.companies as any).logo_url
    }))

    res.json({ branches })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Add existing user to this branch by email (admin only)
router.post('/add-branch-user', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    const branchId = req.headers['x-branch-id'] as string | undefined
    const { email, role = 'member' } = req.body

    if (!email) {
      return res.status(400).json({ error: 'Email is required' })
    }

    // Build query - filter by branch ID if provided
    let query = supabase
      .from('company_users')
      .select('company_id, role')
      .eq('user_id', userId)

    if (branchId) {
      query = query.eq('company_id', branchId)
    }

    const { data: currentUserCompanies } = await query.order('created_at', { ascending: true }).limit(1)

    if (!currentUserCompanies || currentUserCompanies.length === 0) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const currentUserCompany = currentUserCompanies[0]

    // Check if user is owner or admin
    if (currentUserCompany.role !== 'owner' && currentUserCompany.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    // Find user by email in auth.users
    const { data: userData } = await supabase.auth.admin.listUsers()
    const targetUser = userData.users.find(u => u.email?.toLowerCase() === email.toLowerCase())

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found. They must register first.' })
    }

    // Check if user already belongs to this company
    const { data: existingMembership } = await supabase
      .from('company_users')
      .select('id')
      .eq('user_id', targetUser.id)
      .eq('company_id', currentUserCompany.company_id)
      .limit(1)

    if (existingMembership && existingMembership.length > 0) {
      return res.status(400).json({ error: 'User is already a member of this branch' })
    }

    // Add them to company_users for this branch
    const { error: insertError } = await supabase.from('company_users').insert({
      user_id: targetUser.id,
      company_id: currentUserCompany.company_id,
      role: role
    })

    if (insertError) {
      return res.status(400).json({ error: insertError.message })
    }

    // Get company name for audit log
    const { data: company } = await supabase
      .from('companies')
      .select('name_encrypted')
      .eq('id', currentUserCompany.company_id)
      .single()

    const companyName = company ? decrypt(company.name_encrypted) : 'Unknown'

    // Audit log
    await createAuditLog(
      {
        companyId: currentUserCompany.company_id,
        userId: userId!,
        actionType: 'user.added_to_branch',
        resourceType: 'user',
        resourceId: targetUser.id,
        description: `Added ${email} to branch ${companyName}`,
        metadata: {
          targetUserEmail: email,
          role: role
        }
      },
      req
    )

    res.json({ success: true, message: `${email} has been added to this branch` })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Get company branding (public route for forms)
router.get('/branding/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params

    const { data: company, error } = await supabase
      .from('companies')
      .select('logo_url, primary_color, button_color')
      .eq('id', companyId)
      .single()

    if (error || !company) {
      return res.status(404).json({ error: 'Company not found' })
    }

    res.json({
      branding: {
        logo_url: company.logo_url,
        primary_color: company.primary_color || DEFAULT_BRANDING.primaryColor,
        button_color: company.button_color || DEFAULT_BRANDING.buttonColor
      }
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

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

// Get company settings for agreements (includes bank details)
router.get('/settings', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    const branchId = req.headers['x-branch-id'] as string | undefined

    // Build query - filter by branch ID if provided
    let query = supabase
      .from('company_users')
      .select('company_id, role, companies(*)')
      .eq('user_id', userId)

    if (branchId) {
      query = query.eq('company_id', branchId)
    }

    const { data: companyUsers, error: companyUserError } = await query.order('created_at', { ascending: true }).limit(1)

    if (companyUserError || !companyUsers || companyUsers.length === 0) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const companyUser = companyUsers[0]
    const companyData = companyUser.companies as any

    // Decrypt company fields including bank details
    const company = {
      id: companyData.id,
      name: decrypt(companyData.name_encrypted),
      email: decrypt(companyData.email_encrypted),
      phone: decrypt(companyData.phone_encrypted),
      address: decrypt(companyData.address_encrypted),
      city: decrypt(companyData.city_encrypted),
      postcode: decrypt(companyData.postcode_encrypted),
      website: decrypt(companyData.website_encrypted),
      bank_account_name: companyData.bank_account_name || '',
      bank_account_number: companyData.bank_account_number || '',
      bank_sort_code: companyData.bank_sort_code || '',
      offer_notification_email: companyData.offer_notification_email || null,
      reference_notification_email: companyData.reference_notification_email || null,
      logo_url: companyData.logo_url,
      primary_color: companyData.primary_color,
      button_color: companyData.button_color,
      management_info: companyData.management_info || null
    }

    res.json({ company })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Get user's company
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    const branchId = req.headers['x-branch-id'] as string | undefined

    console.log('[GET /api/company] Request headers:', {
      userId,
      branchId,
      'x-branch-id': req.headers['x-branch-id'],
      allHeaders: Object.keys(req.headers)
    })

    // Build query - filter by branch ID if provided
    let query = supabase
      .from('company_users')
      .select('company_id, role, companies(*)')
      .eq('user_id', userId)

    if (branchId) {
      query = query.eq('company_id', branchId)
    }

    const { data: companyUsers, error: companyUserError } = await query.order('created_at', { ascending: true }).limit(1)

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

    // Check if company name needs to be initialized from user metadata
    if (companyUser.companies && !(companyUser.companies as any).name_encrypted) {
      // Get company name from user metadata
      const { data: { user } } = await supabase.auth.admin.getUserById(userId!)
      const companyName = user?.user_metadata?.company_name || `${user?.email?.split('@')[0]}'s Company`

      console.log('Initializing company name from metadata:', {
        userId,
        companyName,
        metadata_company_name: user?.user_metadata?.company_name,
        email: user?.email
      })

      // Encrypt and save the company name
      const { error: updateError } = await supabase
        .from('companies')
        .update({ name_encrypted: encrypt(companyName), updated_at: new Date().toISOString() })
        .eq('id', companyUser.company_id)

      if (!updateError) {
        // Refresh company data
        const { data: updatedCompany } = await supabase
          .from('companies')
          .select('*')
          .eq('id', companyUser.company_id)
          .single()

        if (updatedCompany) {
          ;(companyUser.companies as any) = updatedCompany
        }
      }
    }

    // Trigger RentGoose access check — self-heals legacy companies on first access
    let rentgooseEnabled = (companyUser.companies as any)?.rentgoose_enabled === true
    try {
      const { isRentGooseEnabled } = await import('../services/rentgooseAccess')
      rentgooseEnabled = await isRentGooseEnabled((companyUser.companies as any).id)
    } catch (e) {
      // Non-fatal — fall back to whatever the row says
    }

    // Decrypt company fields
    const company = companyUser.companies ? {
      ...companyUser.companies,
      name: decrypt((companyUser.companies as any).name_encrypted),
      phone: decrypt((companyUser.companies as any).phone_encrypted),
      email: decrypt((companyUser.companies as any).email_encrypted),
      address: decrypt((companyUser.companies as any).address_encrypted),
      city: decrypt((companyUser.companies as any).city_encrypted),
      postcode: decrypt((companyUser.companies as any).postcode_encrypted),
      website: decrypt((companyUser.companies as any).website_encrypted),
      rentgoose_enabled: rentgooseEnabled
    } : null

    console.log('GET /api/company returning:', {
      userId,
      companyName: company?.name,
      hasNameEncrypted: !!(companyUser.companies as any)?.name_encrypted
    })

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
    const branchId = req.headers['x-branch-id'] as string | undefined
    const file = req.file

    if (!file) {
      return res.status(400).json({ error: 'No file provided' })
    }

    // Build query - filter by branch ID if provided
    let query = supabase
      .from('company_users')
      .select('company_id, role')
      .eq('user_id', userId)

    if (branchId) {
      query = query.eq('company_id', branchId)
    }

    const { data: companyUsers } = await query.order('created_at', { ascending: true }).limit(1)

    if (!companyUsers || companyUsers.length === 0) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const companyUser = companyUsers[0]

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
    const branchId = req.headers['x-branch-id'] as string | undefined
    const { name, address, city, postcode, phone, email, website, logo_url, primary_color, button_color, bank_account_name, bank_account_number, bank_sort_code, offer_notification_email, reference_notification_email, management_info, is_vat_registered, vat_number, jmi_enabled } = req.body

    // Debug logging
    console.log('Company update request body:', { name, address, city, postcode, phone, email, website, bank_account_name, bank_account_number, bank_sort_code })

    // Build query - filter by branch ID if provided
    let query = supabase
      .from('company_users')
      .select('company_id, role')
      .eq('user_id', userId)

    if (branchId) {
      query = query.eq('company_id', branchId)
    }

    const { data: companyUsers } = await query.order('created_at', { ascending: true }).limit(1)

    if (!companyUsers || companyUsers.length === 0) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const companyUser = companyUsers[0]

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

    // Build update object - only include fields that are explicitly provided
    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    // Only update fields that are provided in the request
    if (name !== undefined) updateData.name_encrypted = name ? encrypt(name) : null
    if (address !== undefined) updateData.address_encrypted = address ? encrypt(address) : null
    if (city !== undefined) updateData.city_encrypted = city ? encrypt(city) : null
    if (postcode !== undefined) updateData.postcode_encrypted = postcode ? encrypt(postcode) : null
    if (phone !== undefined) updateData.phone_encrypted = phone ? encrypt(phone) : null
    if (email !== undefined) updateData.email_encrypted = email ? encrypt(email) : null
    if (website !== undefined) updateData.website_encrypted = website ? encrypt(website) : null
    if (offer_notification_email !== undefined) updateData.offer_notification_email = offer_notification_email || null
    if (reference_notification_email !== undefined) updateData.reference_notification_email = reference_notification_email || null
    if (logo_url !== undefined) updateData.logo_url = logo_url
    if (primary_color !== undefined) updateData.primary_color = primary_color
    if (button_color !== undefined) updateData.button_color = button_color
    if (bank_account_name !== undefined) updateData.bank_account_name = bank_account_name || null
    if (bank_account_number !== undefined) updateData.bank_account_number = bank_account_number || null
    if (bank_sort_code !== undefined) updateData.bank_sort_code = bank_sort_code || null
    if (management_info !== undefined) updateData.management_info = management_info || null
    if (is_vat_registered !== undefined) updateData.is_vat_registered = is_vat_registered
    if (vat_number !== undefined) updateData.vat_number = vat_number || null
    if (jmi_enabled !== undefined) updateData.jmi_enabled = jmi_enabled

    console.log('Updating company with fields:', Object.keys(updateData))

    // Update company
    const { data, error } = await supabase
      .from('companies')
      .update(updateData)
      .eq('id', companyUser.company_id)
      .select()
      .single()

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    // Track what changed for audit log
    const changes: Record<string, any> = {}
    const encryptedFields = ['name', 'address', 'city', 'postcode', 'phone', 'email', 'website']
    encryptedFields.forEach(field => {
      const oldValue = oldCompany && oldCompany[`${field}_encrypted`] ? decrypt(oldCompany[`${field}_encrypted`]) : null
      const newValue = data[`${field}_encrypted`] ? decrypt(data[`${field}_encrypted`]) : null
      if (oldValue !== newValue) {
        changes[field] = { old: oldValue, new: newValue }
      }
    })

    const nonEncryptedFields = ['logo_url', 'primary_color', 'button_color', 'bank_account_name', 'bank_account_number', 'bank_sort_code']
    nonEncryptedFields.forEach(field => {
      if (oldCompany && data[field] !== oldCompany[field]) {
        changes[field] = { old: oldCompany[field], new: data[field] }
      }
    })

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

    // Decrypt company fields for response
    const decryptedCompany = {
      ...data,
      name: decrypt(data.name_encrypted),
      address: decrypt(data.address_encrypted),
      city: decrypt(data.city_encrypted),
      postcode: decrypt(data.postcode_encrypted),
      phone: decrypt(data.phone_encrypted),
      email: decrypt(data.email_encrypted),
      website: decrypt(data.website_encrypted)
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
    const branchId = req.headers['x-branch-id'] as string | undefined

    // Build query - filter by branch ID if provided
    let query = supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', userId)

    if (branchId) {
      query = query.eq('company_id', branchId)
    }

    const { data: companyUsers } = await query.order('created_at', { ascending: true }).limit(1)

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
    const branchId = req.headers['x-branch-id'] as string | undefined

    // Build query - filter by branch ID if provided
    let query = supabase
      .from('company_users')
      .select('company_id, role')
      .eq('user_id', currentUserId)

    if (branchId) {
      query = query.eq('company_id', branchId)
    }

    const { data: currentUserCompanies } = await query.order('created_at', { ascending: true }).limit(1)

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

// ============================================================================
// OFFER LINK — universal offer form link per company
// ============================================================================

router.get('/offer-link', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) return res.status(404).json({ error: 'Company not found' })

    const frontendUrl = process.env.NODE_ENV === 'production'
      ? 'https://app.propertygoose.co.uk'
      : 'http://localhost:5173'

    res.json({
      url: `${frontendUrl}/tenant-offer?company_id=${companyId}&v2=1`,
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/offer-link/regenerate', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) return res.status(404).json({ error: 'Company not found' })

    const frontendUrl = process.env.NODE_ENV === 'production'
      ? 'https://app.propertygoose.co.uk'
      : 'http://localhost:5173'

    res.json({
      url: `${frontendUrl}/tenant-offer?company_id=${companyId}&v2=1`,
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
