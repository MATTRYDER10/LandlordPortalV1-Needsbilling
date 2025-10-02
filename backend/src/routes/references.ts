import { Router } from 'express'
import { authenticateToken, AuthRequest } from '../middleware/auth'
import { supabase } from '../config/supabase'
import crypto from 'crypto'

const router = Router()

// Get all references for company
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

    // Get all references for the company
    const { data: references, error } = await supabase
      .from('tenant_references')
      .select('*')
      .eq('company_id', companyUser.company_id)
      .order('created_at', { ascending: false })

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    res.json({ references })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Get single reference
router.get('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    const referenceId = req.params.id

    // Get user's company
    const { data: companyUser } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', userId)
      .single()

    if (!companyUser) {
      return res.status(404).json({ error: 'Company not found' })
    }

    // Get reference
    const { data: reference, error } = await supabase
      .from('tenant_references')
      .select('*')
      .eq('id', referenceId)
      .eq('company_id', companyUser.company_id)
      .single()

    if (error || !reference) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    // Get documents for this reference
    const { data: documents } = await supabase
      .from('reference_documents')
      .select('*')
      .eq('reference_id', referenceId)

    res.json({ reference, documents })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Create new reference
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    console.log('Creating reference for user:', userId)

    const {
      tenant_first_name,
      tenant_last_name,
      tenant_email,
      tenant_phone,
      property_address,
      property_city,
      property_postcode,
      monthly_rent,
      move_in_date,
      notes
    } = req.body

    // Validate required fields
    if (!tenant_first_name || !tenant_last_name || !tenant_email || !property_address) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    // Get user's company
    console.log('Looking up company for user:', userId)
    const { data: companyUser, error: companyError } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', userId)
      .single()

    console.log('Company lookup result:', companyUser, 'Error:', companyError)

    if (!companyUser) {
      return res.status(404).json({ error: 'Company not found' })
    }

    // Generate unique token for tenant
    const token = crypto.randomBytes(32).toString('hex')

    // Token expires in 30 days
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 30)

    // Create reference
    const { data: reference, error } = await supabase
      .from('tenant_references')
      .insert({
        company_id: companyUser.company_id,
        created_by: userId,
        tenant_first_name,
        tenant_last_name,
        tenant_email,
        tenant_phone,
        property_address,
        property_city,
        property_postcode,
        monthly_rent,
        move_in_date,
        notes,
        reference_token: token,
        token_expires_at: expiresAt.toISOString(),
        status: 'pending'
      })
      .select()
      .single()

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    // TODO: Send email to tenant with link to submit their information
    const tenantUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/submit-reference/${token}`

    res.json({
      reference,
      tenantUrl,
      message: 'Reference created successfully'
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Update reference
router.put('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    const referenceId = req.params.id
    const updates = req.body

    // Get user's company
    const { data: companyUser } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', userId)
      .single()

    if (!companyUser) {
      return res.status(404).json({ error: 'Company not found' })
    }

    // Update reference
    const { data: reference, error } = await supabase
      .from('tenant_references')
      .update(updates)
      .eq('id', referenceId)
      .eq('company_id', companyUser.company_id)
      .select()
      .single()

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    res.json({ reference, message: 'Reference updated successfully' })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Delete reference
router.delete('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    const referenceId = req.params.id

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

    // Delete reference
    const { error } = await supabase
      .from('tenant_references')
      .delete()
      .eq('id', referenceId)
      .eq('company_id', companyUser.company_id)

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    res.json({ message: 'Reference deleted successfully' })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Tenant submits their information (public route)
router.post('/submit/:token', async (req, res) => {
  try {
    const { token } = req.params
    const {
      employment_status,
      employer_name,
      employer_contact,
      job_title,
      annual_income,
      employment_start_date,
      previous_landlord_name,
      previous_landlord_email,
      previous_landlord_phone,
      previous_address,
      previous_tenancy_duration
    } = req.body

    // Get reference by token
    const { data: reference, error: refError } = await supabase
      .from('tenant_references')
      .select('*')
      .eq('reference_token', token)
      .gte('token_expires_at', new Date().toISOString())
      .single()

    if (refError || !reference) {
      return res.status(404).json({ error: 'Invalid or expired reference link' })
    }

    // Check if already submitted
    if (reference.submitted_at) {
      return res.status(400).json({ error: 'Reference has already been submitted' })
    }

    // Update reference with tenant's information
    const { data: updatedReference, error } = await supabase
      .from('tenant_references')
      .update({
        employment_status,
        employer_name,
        employer_contact,
        job_title,
        annual_income,
        employment_start_date,
        previous_landlord_name,
        previous_landlord_email,
        previous_landlord_phone,
        previous_address,
        previous_tenancy_duration,
        submitted_at: new Date().toISOString(),
        status: 'in_progress'
      })
      .eq('id', reference.id)
      .select()
      .single()

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    res.json({
      message: 'Reference submitted successfully',
      reference: updatedReference
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Get reference by token (public route - for tenant to view)
router.get('/view/:token', async (req, res) => {
  try {
    const { token } = req.params

    const { data: reference, error } = await supabase
      .from('tenant_references')
      .select('id, tenant_first_name, tenant_last_name, property_address, property_city, property_postcode, monthly_rent, move_in_date, submitted_at, status')
      .eq('reference_token', token)
      .gte('token_expires_at', new Date().toISOString())
      .single()

    if (error || !reference) {
      return res.status(404).json({ error: 'Invalid or expired reference link' })
    }

    res.json({ reference })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

export default router
