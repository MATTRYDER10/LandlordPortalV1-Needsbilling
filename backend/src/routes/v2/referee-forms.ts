/**
 * V2 Referee Forms Routes
 *
 * Public endpoints for referee forms (guarantor, employer, landlord, accountant).
 * These are called by external parties to provide reference information.
 */

import express, { Request, Response, Router } from 'express'
import { supabase } from '../../config/supabase'
import { encrypt } from '../../services/encryption'

const router: Router = express.Router()

// ============================================================================
// GUARANTOR FORM
// ============================================================================

// GET /api/v2/guarantor-form/:token
router.get('/guarantor-form/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params

    const { data: guarantor, error } = await supabase
      .from('v2_guarantors')
      .select(`
        id,
        guarantor_email,
        form_submitted_at,
        reference:v2_references!inner(
          id,
          tenant_first_name,
          tenant_last_name,
          property_address,
          monthly_rent,
          company_id
        )
      `)
      .eq('form_token', token)
      .single()

    if (error || !guarantor) {
      return res.status(404).json({ error: 'Reference not found or link expired' })
    }

    const ref = (guarantor as any).reference
    const { data: company } = await supabase
      .from('companies')
      .select('name, logo_url')
      .eq('id', ref.company_id)
      .single()

    return res.json({
      reference: {
        id: guarantor.id,
        tenant_name: `${ref.tenant_first_name || ''} ${ref.tenant_last_name || ''}`.trim(),
        property_address: ref.property_address,
        monthly_rent: ref.monthly_rent,
        guarantor_email: guarantor.guarantor_email,
        form_submitted_at: guarantor.form_submitted_at
      },
      companyName: company?.name || 'PropertyGoose',
      companyLogo: company?.logo_url || ''
    })
  } catch (error) {
    console.error('Error fetching guarantor form:', error)
    return res.status(500).json({ error: 'Failed to load reference' })
  }
})

// POST /api/v2/guarantor-form/:token/submit
router.post('/guarantor-form/:token/submit', async (req: Request, res: Response) => {
  try {
    const { token } = req.params
    const { identity, address, income, consent } = req.body

    const { data: guarantor, error: gError } = await supabase
      .from('v2_guarantors')
      .select('id, reference_id, form_submitted_at')
      .eq('form_token', token)
      .single()

    if (gError || !guarantor) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    if (guarantor.form_submitted_at) {
      return res.status(400).json({ error: 'Form has already been submitted' })
    }

    const encryptedFormData = {
      identity: {
        ...identity,
        dateOfBirth: identity.dateOfBirth ? encrypt(identity.dateOfBirth) : null
      },
      address,
      income,
      consent: {
        ...consent,
        timestamp: new Date().toISOString()
      }
    }

    const { error: updateError } = await supabase
      .from('v2_guarantors')
      .update({
        guarantor_first_name: identity.firstName,
        guarantor_last_name: identity.lastName,
        guarantor_phone: identity.phone,
        form_data: encryptedFormData,
        form_submitted_at: new Date().toISOString()
      })
      .eq('id', guarantor.id)

    if (updateError) {
      console.error('Error submitting guarantor form:', updateError)
      return res.status(500).json({ error: 'Failed to submit reference' })
    }

    return res.json({ success: true })
  } catch (error) {
    console.error('Error submitting guarantor form:', error)
    return res.status(500).json({ error: 'Failed to submit reference' })
  }
})

// ============================================================================
// EMPLOYER FORM
// ============================================================================

// GET /api/v2/employer-form/:token
router.get('/employer-form/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params

    const { data: referee, error } = await supabase
      .from('v2_referees')
      .select(`
        id,
        referee_type,
        referee_email,
        submitted_at,
        reference:v2_references!inner(
          id,
          tenant_first_name,
          tenant_last_name,
          form_data,
          company_id
        )
      `)
      .eq('form_token', token)
      .eq('referee_type', 'EMPLOYER')
      .single()

    if (error || !referee) {
      return res.status(404).json({ error: 'Reference not found or link expired' })
    }

    const ref = (referee as any).reference
    const { data: company } = await supabase
      .from('companies')
      .select('name, logo_url')
      .eq('id', ref.company_id)
      .single()

    const employerName = ref.form_data?.income?.employerName || ''

    return res.json({
      reference: {
        id: referee.id,
        employee_name: `${ref.tenant_first_name || ''} ${ref.tenant_last_name || ''}`.trim(),
        employer_name: employerName,
        submitted_at: referee.submitted_at
      },
      companyName: company?.name || 'A letting agent',
      companyLogo: company?.logo_url || ''
    })
  } catch (error) {
    console.error('Error fetching employer form:', error)
    return res.status(500).json({ error: 'Failed to load reference' })
  }
})

// POST /api/v2/employer-form/:token/submit
router.post('/employer-form/:token/submit', async (req: Request, res: Response) => {
  try {
    const { token } = req.params
    const formData = req.body

    const { data: referee, error: rError } = await supabase
      .from('v2_referees')
      .select('id, reference_id, submitted_at')
      .eq('form_token', token)
      .eq('referee_type', 'EMPLOYER')
      .single()

    if (rError || !referee) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    if (referee.submitted_at) {
      return res.status(400).json({ error: 'Form has already been submitted' })
    }

    const { error: updateError } = await supabase
      .from('v2_referees')
      .update({
        referee_name: formData.refereeName,
        form_data: {
          ...formData,
          submittedAt: new Date().toISOString()
        },
        submitted_at: new Date().toISOString()
      })
      .eq('id', referee.id)

    if (updateError) {
      console.error('Error submitting employer form:', updateError)
      return res.status(500).json({ error: 'Failed to submit reference' })
    }

    // Update the INCOME section to READY if it's PENDING
    await supabase
      .from('v2_sections')
      .update({ queue_status: 'READY' })
      .eq('reference_id', referee.reference_id)
      .eq('section_type', 'INCOME')
      .eq('queue_status', 'PENDING')

    return res.json({ success: true })
  } catch (error) {
    console.error('Error submitting employer form:', error)
    return res.status(500).json({ error: 'Failed to submit reference' })
  }
})

// ============================================================================
// LANDLORD FORM
// ============================================================================

// GET /api/v2/landlord-form/:token
router.get('/landlord-form/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params

    const { data: referee, error } = await supabase
      .from('v2_referees')
      .select(`
        id,
        referee_type,
        referee_email,
        submitted_at,
        reference:v2_references!inner(
          id,
          tenant_first_name,
          tenant_last_name,
          company_id
        )
      `)
      .eq('form_token', token)
      .eq('referee_type', 'LANDLORD')
      .single()

    if (error || !referee) {
      return res.status(404).json({ error: 'Reference not found or link expired' })
    }

    const ref = (referee as any).reference
    const { data: company } = await supabase
      .from('companies')
      .select('name, logo_url')
      .eq('id', ref.company_id)
      .single()

    return res.json({
      reference: {
        id: referee.id,
        tenant_name: `${ref.tenant_first_name || ''} ${ref.tenant_last_name || ''}`.trim(),
        submitted_at: referee.submitted_at
      },
      companyName: company?.name || 'A letting agent',
      companyLogo: company?.logo_url || ''
    })
  } catch (error) {
    console.error('Error fetching landlord form:', error)
    return res.status(500).json({ error: 'Failed to load reference' })
  }
})

// POST /api/v2/landlord-form/:token/submit
router.post('/landlord-form/:token/submit', async (req: Request, res: Response) => {
  try {
    const { token } = req.params
    const formData = req.body

    const { data: referee, error: rError } = await supabase
      .from('v2_referees')
      .select('id, reference_id, submitted_at')
      .eq('form_token', token)
      .eq('referee_type', 'LANDLORD')
      .single()

    if (rError || !referee) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    if (referee.submitted_at) {
      return res.status(400).json({ error: 'Form has already been submitted' })
    }

    const { error: updateError } = await supabase
      .from('v2_referees')
      .update({
        referee_name: formData.refereeName,
        form_data: {
          ...formData,
          submittedAt: new Date().toISOString()
        },
        submitted_at: new Date().toISOString()
      })
      .eq('id', referee.id)

    if (updateError) {
      console.error('Error submitting landlord form:', updateError)
      return res.status(500).json({ error: 'Failed to submit reference' })
    }

    // Update the RESIDENTIAL section to READY if it's PENDING
    await supabase
      .from('v2_sections')
      .update({ queue_status: 'READY' })
      .eq('reference_id', referee.reference_id)
      .eq('section_type', 'RESIDENTIAL')
      .eq('queue_status', 'PENDING')

    return res.json({ success: true })
  } catch (error) {
    console.error('Error submitting landlord form:', error)
    return res.status(500).json({ error: 'Failed to submit reference' })
  }
})

// ============================================================================
// ACCOUNTANT FORM
// ============================================================================

// GET /api/v2/accountant-form/:token
router.get('/accountant-form/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params

    const { data: referee, error } = await supabase
      .from('v2_referees')
      .select(`
        id,
        referee_type,
        referee_email,
        submitted_at,
        reference:v2_references!inner(
          id,
          tenant_first_name,
          tenant_last_name,
          company_id
        )
      `)
      .eq('form_token', token)
      .eq('referee_type', 'ACCOUNTANT')
      .single()

    if (error || !referee) {
      return res.status(404).json({ error: 'Reference not found or link expired' })
    }

    const ref = (referee as any).reference
    const { data: company } = await supabase
      .from('companies')
      .select('name, logo_url')
      .eq('id', ref.company_id)
      .single()

    return res.json({
      reference: {
        id: referee.id,
        client_name: `${ref.tenant_first_name || ''} ${ref.tenant_last_name || ''}`.trim(),
        submitted_at: referee.submitted_at
      },
      companyName: company?.name || 'A letting agent',
      companyLogo: company?.logo_url || ''
    })
  } catch (error) {
    console.error('Error fetching accountant form:', error)
    return res.status(500).json({ error: 'Failed to load reference' })
  }
})

// POST /api/v2/accountant-form/:token/submit
router.post('/accountant-form/:token/submit', async (req: Request, res: Response) => {
  try {
    const { token } = req.params
    const formData = req.body

    const { data: referee, error: rError } = await supabase
      .from('v2_referees')
      .select('id, reference_id, submitted_at')
      .eq('form_token', token)
      .eq('referee_type', 'ACCOUNTANT')
      .single()

    if (rError || !referee) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    if (referee.submitted_at) {
      return res.status(400).json({ error: 'Form has already been submitted' })
    }

    const { error: updateError } = await supabase
      .from('v2_referees')
      .update({
        referee_name: formData.accountantName,
        form_data: {
          ...formData,
          submittedAt: new Date().toISOString()
        },
        submitted_at: new Date().toISOString()
      })
      .eq('id', referee.id)

    if (updateError) {
      console.error('Error submitting accountant form:', updateError)
      return res.status(500).json({ error: 'Failed to submit reference' })
    }

    // Update the INCOME section to READY if it's PENDING
    await supabase
      .from('v2_sections')
      .update({ queue_status: 'READY' })
      .eq('reference_id', referee.reference_id)
      .eq('section_type', 'INCOME')
      .eq('queue_status', 'PENDING')

    return res.json({ success: true })
  } catch (error) {
    console.error('Error submitting accountant form:', error)
    return res.status(500).json({ error: 'Failed to submit reference' })
  }
})

export default router
