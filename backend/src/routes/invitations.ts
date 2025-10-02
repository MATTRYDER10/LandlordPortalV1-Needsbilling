import { Router } from 'express'
import { authenticateToken, AuthRequest } from '../middleware/auth'
import { supabase } from '../config/supabase'
import crypto from 'crypto'

const router = Router()

// Get invitations for company
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
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

    // Get pending invitations
    const { data: invitations, error } = await supabase
      .from('invitations')
      .select('*')
      .eq('company_id', companyUser.company_id)
      .eq('status', 'pending')
      .gte('expires_at', new Date().toISOString())

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    res.json({ invitations })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Create invitation
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    const { email, role } = req.body

    if (!email || !role) {
      return res.status(400).json({ error: 'Email and role are required' })
    }

    // Get user's company and role
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

    // Check if user with this email already exists in the company
    const { data: { users } } = await supabase.auth.admin.listUsers()
    const existingUser = users.find((u: any) => u.email === email)

    if (existingUser) {
      const { data: existingMember } = await supabase
        .from('company_users')
        .select('id')
        .eq('user_id', existingUser.id)
        .eq('company_id', companyUser.company_id)
        .single()

      if (existingMember) {
        return res.status(400).json({ error: 'User is already a member of this company' })
      }
    }

    // Check if there's already a pending invitation
    const { data: existingInvite } = await supabase
      .from('invitations')
      .select('id')
      .eq('email', email)
      .eq('company_id', companyUser.company_id)
      .eq('status', 'pending')
      .gte('expires_at', new Date().toISOString())
      .single()

    if (existingInvite) {
      return res.status(400).json({ error: 'An invitation has already been sent to this email' })
    }

    // Generate unique token
    const token = crypto.randomBytes(32).toString('hex')

    // Create invitation (expires in 7 days)
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    const { data: invitation, error } = await supabase
      .from('invitations')
      .insert({
        company_id: companyUser.company_id,
        email,
        role,
        token,
        invited_by: userId,
        expires_at: expiresAt.toISOString()
      })
      .select()
      .single()

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    // TODO: Send invitation email via SendGrid
    const invitationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/accept-invite/${token}`

    res.json({
      invitation,
      invitationUrl,
      message: 'Invitation created successfully'
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Resend invitation
router.post('/:invitationId/resend', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    const invitationId = req.params.invitationId

    // Get user's company and role
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

    // Get invitation
    const { data: invitation, error } = await supabase
      .from('invitations')
      .select('*')
      .eq('id', invitationId)
      .eq('company_id', companyUser.company_id)
      .single()

    if (error || !invitation) {
      return res.status(404).json({ error: 'Invitation not found' })
    }

    // Extend expiration
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    await supabase
      .from('invitations')
      .update({ expires_at: expiresAt.toISOString() })
      .eq('id', invitationId)

    // TODO: Resend invitation email via SendGrid
    const invitationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/accept-invite/${invitation.token}`

    res.json({
      message: 'Invitation resent successfully',
      invitationUrl
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Revoke invitation
router.delete('/:invitationId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    const invitationId = req.params.invitationId

    // Get user's company and role
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

    // Delete invitation
    const { error } = await supabase
      .from('invitations')
      .delete()
      .eq('id', invitationId)
      .eq('company_id', companyUser.company_id)

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    res.json({ message: 'Invitation revoked successfully' })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Accept invitation (public route)
router.post('/accept/:token', async (req, res) => {
  try {
    const { token } = req.params
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }

    // Get invitation
    const { data: invitation, error: inviteError } = await supabase
      .from('invitations')
      .select('*')
      .eq('token', token)
      .eq('status', 'pending')
      .gte('expires_at', new Date().toISOString())
      .single()

    if (inviteError || !invitation) {
      return res.status(404).json({ error: 'Invalid or expired invitation' })
    }

    // Check if email matches
    if (invitation.email !== email) {
      return res.status(400).json({ error: 'Email does not match invitation' })
    }

    // Create user account
    const { data: authData, error: signUpError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    })

    if (signUpError) {
      return res.status(400).json({ error: signUpError.message })
    }

    // Add user to company
    const { error: companyUserError } = await supabase
      .from('company_users')
      .insert({
        company_id: invitation.company_id,
        user_id: authData.user.id,
        role: invitation.role
      })

    if (companyUserError) {
      return res.status(400).json({ error: companyUserError.message })
    }

    // Mark invitation as accepted
    await supabase
      .from('invitations')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString()
      })
      .eq('id', invitation.id)

    res.json({
      message: 'Invitation accepted successfully',
      user: authData.user
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

export default router
