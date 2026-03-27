import { Router } from 'express'
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth'
import { supabase } from '../config/supabase'
import { sendUserInvitation } from '../services/emailService'
import { createAuditLog, formatUserName } from '../services/auditLog'
import { generateToken, hash, encrypt, decrypt } from '../services/encryption'
import { getFrontendUrl } from '../utils/frontendUrl'

const router = Router()
const frontendUrl = getFrontendUrl()

// Get invitations for company (admin only)
router.get('/', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    // Use companyId from middleware (respects X-Branch-Id header)
    const companyId = req.companyId

    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    // Get pending invitations
    const { data: invitations, error } = await supabase
      .from('invitations')
      .select('*')
      .eq('company_id', companyId)
      .eq('status', 'pending')
      .gte('expires_at', new Date().toISOString())

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    // Decrypt sensitive fields
    const decryptedInvitations = invitations?.map(inv => ({
      ...inv,
      email: decrypt(inv.email_encrypted)
    }))

    res.json({ invitations: decryptedInvitations })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Create invitation (admin only)
router.post('/', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    const { email, password, role } = req.body

    if (!email || !role) {
      return res.status(400).json({ error: 'Email and role are required' })
    }

    // Use companyId from middleware (respects X-Branch-Id header)
    const companyId = req.companyId

    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    // Check if user with this email already exists in the company
    const { data: { users } } = await supabase.auth.admin.listUsers()
    const existingUser = users.find((u: any) => u.email === email)

    if (existingUser) {
      const { data: existingMember } = await supabase
        .from('company_users')
        .select('id')
        .eq('user_id', existingUser.id)
        .eq('company_id', companyId)
        .single()

      if (existingMember) {
        return res.status(400).json({ error: 'User is already a member of this company' })
      }
    }

    // If password provided and user doesn't exist, create user + add to company immediately
    if (password && !existingUser) {
      const { data: authData, error: createError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { is_invited: true }
      })

      if (createError) {
        return res.status(400).json({ error: createError.message })
      }

      // Add to company
      await supabase.from('company_users').insert({
        user_id: authData.user.id,
        company_id: companyId,
        role
      })

      return res.json({
        success: true,
        message: `Account created for ${email} and added to company`,
        immediate: true
      })
    }

    // Check if there's already a pending invitation
    const { data: existingInvite } = await supabase
      .from('invitations')
      .select('id')
      .eq('email', email)
      .eq('company_id', companyId)
      .eq('status', 'pending')
      .gte('expires_at', new Date().toISOString())
      .single()

    if (existingInvite) {
      return res.status(400).json({ error: 'An invitation has already been sent to this email' })
    }

    // Generate unique token and hash it for secure storage
    const token = generateToken()
    const tokenHash = hash(token)

    // Create invitation (expires in 7 days)
    const invitationExpiresAt = new Date()
    invitationExpiresAt.setDate(invitationExpiresAt.getDate() + 7)

    const { data: invitation, error } = await supabase
      .from('invitations')
      .insert({
        company_id: companyId,
        email_encrypted: encrypt(email),
        role,
        token_hash: tokenHash,
        invited_by: userId,
        expires_at: invitationExpiresAt.toISOString()
      })
      .select()
      .single()

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    // Get company and inviter details for email
    const { data: company } = await supabase
      .from('companies')
      .select('name_encrypted')
      .eq('id', companyId)
      .single()

    const { data: { user: inviter } } = await supabase.auth.admin.getUserById(userId!)

    const invitationUrl = `${frontendUrl}/accept-invite/${token}`

    // Send invitation email
    try {
      const inviterName = inviter?.user_metadata?.full_name || inviter?.email?.split('@')[0] || 'A team member'
      const expiresAtFormatted = new Date(invitation.expires_at).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })

      const companyName = company?.name_encrypted ? (decrypt(company.name_encrypted) || 'the team') : 'the team'

      await sendUserInvitation(
        email,
        inviterName,
        companyName,
        role,
        invitationUrl,
        expiresAtFormatted
      )
    } catch (emailError) {
      console.error('Failed to send invitation email:', emailError)
      // Continue anyway - invitation was created
    }

    // Audit log
    await createAuditLog(
      {
        companyId: companyId,
        userId: userId!,
        actionType: 'user.invited',
        resourceType: 'invitation',
        resourceId: invitation.id,
        description: `Invited ${email} as ${role}`,
        metadata: { email, role }
      },
      req
    )

    res.json({
      invitation,
      message: 'Invitation sent successfully'
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Resend invitation (admin only)
router.post('/:invitationId/resend', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    const invitationId = req.params.invitationId

    // Use companyId from middleware (respects X-Branch-Id header)
    const companyId = req.companyId

    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    // Get invitation
    const { data: invitation, error } = await supabase
      .from('invitations')
      .select('*')
      .eq('id', invitationId)
      .eq('company_id', companyId)
      .single()

    if (error || !invitation) {
      return res.status(404).json({ error: 'Invitation not found' })
    }

    // Extend expiration
    const newExpiresAt = new Date()
    newExpiresAt.setDate(newExpiresAt.getDate() + 7)

    await supabase
      .from('invitations')
      .update({ expires_at: newExpiresAt.toISOString() })
      .eq('id', invitationId)

    const invitationUrl = `${frontendUrl}/accept-invite/${invitation.token}`

    // Resend invitation email
    try {
      // Get company and inviter details for email
      const { data: company } = await supabase
        .from('companies')
        .select('name_encrypted')
        .eq('id', companyId)
        .single()

      const { data: { user: inviter } } = await supabase.auth.admin.getUserById(userId!)

      const inviterName = inviter?.user_metadata?.full_name || inviter?.email?.split('@')[0] || 'A team member'
      const expiresAtFormatted = newExpiresAt.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })

      const invitationEmail: string = decrypt(invitation.email_encrypted) || ''
      const companyName: string = company?.name_encrypted ? (decrypt(company.name_encrypted) || 'the team') : 'the team'

      await sendUserInvitation(
        invitationEmail,
        inviterName,
        companyName,
        invitation.role,
        invitationUrl,
        expiresAtFormatted
      )
    } catch (emailError) {
      console.error('Failed to resend invitation email:', emailError)
      // Continue anyway
    }

    // Audit log
    const invitationEmail = decrypt(invitation.email_encrypted) as string
    await createAuditLog(
      {
        companyId: companyId,
        userId: userId!,
        actionType: 'user.invitation_resent',
        resourceType: 'invitation',
        resourceId: invitationId,
        description: `Resent invitation to ${invitationEmail}`,
        metadata: { email: invitationEmail, role: invitation.role }
      },
      req
    )

    res.json({
      message: 'Invitation resent successfully'
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Revoke invitation (admin only)
router.delete('/:invitationId', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    const invitationId = req.params.invitationId

    // Use companyId from middleware (respects X-Branch-Id header)
    const companyId = req.companyId

    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    // Get invitation details before deletion for audit log
    const { data: invitation } = await supabase
      .from('invitations')
      .select('email_encrypted, role')
      .eq('id', invitationId)
      .eq('company_id', companyId)
      .single()

    // Delete invitation
    const { error } = await supabase
      .from('invitations')
      .delete()
      .eq('id', invitationId)
      .eq('company_id', companyId)

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    // Audit log
    if (invitation) {
      const invitationEmail = decrypt(invitation.email_encrypted) as string
      await createAuditLog(
        {
          companyId: companyId,
          userId: userId!,
          actionType: 'user.invitation_revoked',
          resourceType: 'invitation',
          resourceId: invitationId,
          description: `Revoked invitation for ${invitationEmail}`,
          metadata: { email: invitationEmail, role: invitation.role }
        },
        req
      )
    }

    res.json({ message: 'Invitation revoked successfully' })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Get invitation details (public route)
router.get('/details/:token', async (req, res) => {
  try {
    const { token } = req.params
    const tokenHash = hash(token)

    // Get invitation by token hash
    const { data: invitation, error: inviteError } = await supabase
      .from('invitations')
      .select('email_encrypted, role, expires_at, company_id')
      .eq('token_hash', tokenHash)
      .eq('status', 'pending')
      .gte('expires_at', new Date().toISOString())
      .single()

    if (inviteError || !invitation) {
      return res.status(404).json({ error: 'Invalid or expired invitation' })
    }

    const invitationEmail = decrypt(invitation.email_encrypted) || ''

    // Check if user already exists
    const { data: userData } = await supabase.auth.admin.listUsers()
    const existingUser = userData.users.find(u => u.email?.toLowerCase() === invitationEmail.toLowerCase())

    // Get company name for display
    const { data: company } = await supabase
      .from('companies')
      .select('name_encrypted')
      .eq('id', invitation.company_id)
      .single()

    const companyName = company?.name_encrypted ? decrypt(company.name_encrypted) : 'the team'

    res.json({
      email: invitationEmail,
      role: invitation.role,
      expiresAt: invitation.expires_at,
      companyName,
      userExists: !!existingUser,
      existingUserName: existingUser?.user_metadata?.full_name || null
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Accept invitation (public route)
router.post('/accept/:token', async (req, res) => {
  try {
    const { token } = req.params
    const { fullName, password } = req.body

    // Hash the token to look up the invitation securely
    const tokenHash = hash(token)

    // Get invitation by token hash
    const { data: invitation, error: inviteError } = await supabase
      .from('invitations')
      .select('*')
      .eq('token_hash', tokenHash)
      .eq('status', 'pending')
      .gte('expires_at', new Date().toISOString())
      .single()

    if (inviteError || !invitation) {
      return res.status(404).json({ error: 'Invalid or expired invitation' })
    }

    const invitationEmail: string = decrypt(invitation.email_encrypted) || ''

    // Check if user already exists in auth.users
    const { data: userData } = await supabase.auth.admin.listUsers()
    const existingUser = userData.users.find(u => u.email?.toLowerCase() === invitationEmail.toLowerCase())

    let userId: string
    let userFullName: string

    if (existingUser) {
      // User already exists - just link them to the new branch
      userId = existingUser.id
      userFullName = existingUser.user_metadata?.full_name || existingUser.email?.split('@')[0] || 'User'
    } else {
      // New user - need fullName and password to create account
      if (!fullName || !password) {
        return res.status(400).json({ error: 'Full name and password are required for new accounts' })
      }

      // Create user account (with metadata flag to prevent company creation in trigger)
      const { data: authData, error: signUpError } = await supabase.auth.admin.createUser({
        email: invitationEmail,
        password: password,
        email_confirm: true,
        user_metadata: {
          is_invited: true,
          full_name: fullName
        }
      })

      if (signUpError) {
        return res.status(400).json({ error: signUpError.message })
      }

      userId = authData.user.id
      userFullName = fullName
    }

    // Check if user is already in company (prevent duplicates)
    const { data: existingMembership } = await supabase
      .from('company_users')
      .select('id')
      .eq('user_id', userId)
      .eq('company_id', invitation.company_id)
      .limit(1)

    // Add user to company only if not already a member
    if (!existingMembership || existingMembership.length === 0) {
      const { error: companyUserError } = await supabase
        .from('company_users')
        .insert({
          company_id: invitation.company_id,
          user_id: userId,
          role: invitation.role
        })

      if (companyUserError) {
        return res.status(400).json({ error: companyUserError.message })
      }
    }

    // Mark invitation as accepted
    await supabase
      .from('invitations')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString()
      })
      .eq('id', invitation.id)

    // Audit log
    await createAuditLog(
      {
        companyId: invitation.company_id,
        userId: userId,
        actionType: 'user.joined',
        resourceType: 'user',
        resourceId: userId,
        description: `${userFullName} (${invitationEmail}) joined as ${invitation.role}`,
        metadata: { email: invitationEmail, role: invitation.role, fullName: userFullName }
      },
      req
    )

    res.json({
      message: existingUser ? 'You now have access to this branch' : 'Invitation accepted successfully',
      isExistingUser: !!existingUser
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

export default router
