/**
 * V2 Referee Forms Routes
 *
 * Public endpoints for referee forms (guarantor, employer, landlord, accountant).
 * These are called by external parties to provide reference information.
 */

import express, { Request, Response, Router } from 'express'
import { supabase } from '../../config/supabase'
import { encrypt, decrypt, hash } from '../../services/encryption'
import { logActivity } from '../../services/v2/activityServiceV2'

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
      .select('id, guarantor_email, form_completed_at, reference_id')
      .eq('form_token_hash', hash(token))
      .single()

    if (error || !guarantor) {
      return res.status(404).json({ error: 'Reference not found or link expired' })
    }

    const { data: ref } = await supabase
      .from('tenant_references_v2')
      .select('id, tenant_first_name_encrypted, tenant_last_name_encrypted, property_address, monthly_rent, company_id')
      .eq('id', guarantor.reference_id)
      .single()

    if (!ref) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    const { data: company } = await supabase
      .from('companies')
      .select('*')
      .eq('id', ref.company_id)
      .maybeSingle()

    const co = company as any
    return res.json({
      reference: {
        id: guarantor.id,
        tenant_name: `${decrypt(ref.tenant_first_name_encrypted) || ''} ${decrypt(ref.tenant_last_name_encrypted) || ''}`.trim(),
        property_address: ref.property_address,
        monthly_rent: ref.monthly_rent,
        guarantor_email: guarantor.guarantor_email,
        form_completed_at: guarantor.form_completed_at
      },
      companyName: co?.name || (co?.name_encrypted ? decrypt(co.name_encrypted) : null) || co?.company_name || 'PropertyGoose',
      companyLogo: co?.logo_url || ''
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
      .select('id, reference_id, form_completed_at')
      .eq('form_token_hash', hash(token))
      .single()

    if (gError || !guarantor) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    if (guarantor.form_completed_at) {
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
        form_completed_at: new Date().toISOString()
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

    // Hash the token to look up in DB
    const tokenHash = hash(token)

    const { data: referee, error } = await supabase
      .from('referees_v2')
      .select('id, referee_type, referee_email_encrypted, completed_at, reference_id')
      .eq('form_token_hash', tokenHash)
      .eq('referee_type', 'EMPLOYER')
      .maybeSingle()

    if (error || !referee) {
      return res.status(404).json({ error: 'Reference not found or link expired' })
    }

    // Get reference details separately
    const { data: ref } = await supabase
      .from('tenant_references_v2')
      .select('id, tenant_first_name_encrypted, tenant_last_name_encrypted, form_data, company_id')
      .eq('id', referee.reference_id)
      .single()

    if (!ref) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    const { data: company } = await supabase
      .from('companies')
      .select('*')
      .eq('id', ref.company_id)
      .maybeSingle()

    const empCo = company as any
    const employerName = ref.form_data?.income?.employerName || ''

    return res.json({
      reference: {
        id: referee.id,
        employee_name: `${decrypt(ref.tenant_first_name_encrypted) || ''} ${decrypt(ref.tenant_last_name_encrypted) || ''}`.trim(),
        employer_name: employerName,
        submitted_at: referee.completed_at
      },
      companyName: empCo?.name || (empCo?.name_encrypted ? decrypt(empCo.name_encrypted) : null) || empCo?.company_name || 'A letting agent',
      companyLogo: empCo?.logo_url || ''
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
      .from('referees_v2')
      .select('id, reference_id, completed_at')
      .eq('form_token_hash', hash(token))
      .eq('referee_type', 'EMPLOYER')
      .single()

    if (rError || !referee) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    if (referee.completed_at) {
      return res.status(400).json({ error: 'Form has already been submitted' })
    }

    const { error: updateError } = await supabase
      .from('referees_v2')
      .update({
        referee_name: formData.refereeName,
        form_data: {
          ...formData,
          submittedAt: new Date().toISOString()
        },
        completed_at: new Date().toISOString()
      })
      .eq('id', referee.id)

    if (updateError) {
      console.error('Error submitting employer form:', updateError)
      return res.status(500).json({ error: 'Failed to submit reference' })
    }

    // Move INCOME section to READY — employer submitted their form, verify staff need to see it
    const { data: empIncSection } = await supabase
      .from('reference_sections_v2')
      .select('id, section_data')
      .eq('reference_id', referee.reference_id)
      .eq('section_type', 'INCOME')
      .eq('queue_status', 'PENDING')
      .maybeSingle()

    if (empIncSection) {
      const now = new Date().toISOString()
      await supabase
        .from('reference_sections_v2')
        .update({
          queue_status: 'READY',
          referee_submitted_at: now,
          queue_entered_at: now,
          section_data: {
            ...(empIncSection.section_data || {}),
            evidence_status: 'REFEREE_RECEIVED',
            employer_reference_received: true,
            employer_reference_received_at: now
          },
          updated_at: now
        })
        .eq('id', empIncSection.id)

      await logActivity({
        referenceId: referee.reference_id,
        sectionId: empIncSection.id,
        action: 'INCOME_MOVED_TO_READY',
        performedBy: 'system',
        performedByType: 'system',
        notes: `Employer reference submitted by ${formData.refereeName || 'employer'} — INCOME section moved to READY for verification`
      })
    }

    // Resolve any chase items for this referee
    await supabase
      .from('chase_items_v2')
      .update({
        status: 'RECEIVED',
        resolved_at: new Date().toISOString()
      })
      .eq('reference_id', referee.reference_id)
      .eq('referee_type', 'EMPLOYER')
      .in('status', ['IN_CHASE_QUEUE', 'WAITING'])

    await logActivity({
      referenceId: referee.reference_id,
      action: 'EMPLOYER_REFERENCE_RECEIVED',
      performedBy: 'referee',
      performedByType: 'referee',
      notes: `Employer reference submitted by ${req.body.refereeName || 'employer'}`
    })

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
      .from('referees_v2')
      .select('id, referee_type, referee_email_encrypted, completed_at, reference_id')
      .eq('form_token_hash', hash(token))
      .eq('referee_type', 'LANDLORD')
      .maybeSingle()

    if (error || !referee) {
      return res.status(404).json({ error: 'Reference not found or link expired' })
    }

    const { data: ref } = await supabase
      .from('tenant_references_v2')
      .select('id, tenant_first_name_encrypted, tenant_last_name_encrypted, company_id')
      .eq('id', referee.reference_id)
      .single()

    if (!ref) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    const { data: company } = await supabase
      .from('companies')
      .select('*')
      .eq('id', ref.company_id)
      .maybeSingle()

    const llCo = company as any
    return res.json({
      reference: {
        id: referee.id,
        tenant_name: `${decrypt(ref.tenant_first_name_encrypted) || ''} ${decrypt(ref.tenant_last_name_encrypted) || ''}`.trim(),
        submitted_at: referee.completed_at
      },
      companyName: llCo?.name || (llCo?.name_encrypted ? decrypt(llCo.name_encrypted) : null) || llCo?.company_name || 'A letting agent',
      companyLogo: llCo?.logo_url || ''
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
      .from('referees_v2')
      .select('id, reference_id, completed_at')
      .eq('form_token_hash', hash(token))
      .eq('referee_type', 'LANDLORD')
      .single()

    if (rError || !referee) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    if (referee.completed_at) {
      return res.status(400).json({ error: 'Form has already been submitted' })
    }

    const { error: updateError } = await supabase
      .from('referees_v2')
      .update({
        referee_name: formData.refereeName,
        form_data: {
          ...formData,
          submittedAt: new Date().toISOString()
        },
        completed_at: new Date().toISOString()
      })
      .eq('id', referee.id)

    if (updateError) {
      console.error('Error submitting landlord form:', updateError)
      return res.status(500).json({ error: 'Failed to submit reference' })
    }

    // Move RESIDENTIAL section to READY — landlord submitted their form, verify staff need to see it
    const { data: llResSection } = await supabase
      .from('reference_sections_v2')
      .select('id, section_data')
      .eq('reference_id', referee.reference_id)
      .eq('section_type', 'RESIDENTIAL')
      .eq('queue_status', 'PENDING')
      .maybeSingle()

    if (llResSection) {
      const now = new Date().toISOString()
      await supabase
        .from('reference_sections_v2')
        .update({
          queue_status: 'READY',
          referee_submitted_at: now,
          queue_entered_at: now,
          section_data: {
            ...(llResSection.section_data || {}),
            evidence_status: 'REFEREE_RECEIVED',
            landlord_reference_received: true,
            landlord_reference_received_at: now
          },
          updated_at: now
        })
        .eq('id', llResSection.id)

      await logActivity({
        referenceId: referee.reference_id,
        sectionId: llResSection.id,
        action: 'RESIDENTIAL_MOVED_TO_READY',
        performedBy: 'system',
        performedByType: 'system',
        notes: `Landlord reference submitted — RESIDENTIAL section moved to READY for verification`
      })
    }

    // Resolve any chase items for this referee
    await supabase
      .from('chase_items_v2')
      .update({
        status: 'RECEIVED',
        resolved_at: new Date().toISOString()
      })
      .eq('reference_id', referee.reference_id)
      .eq('referee_type', 'LANDLORD')
      .in('status', ['IN_CHASE_QUEUE', 'WAITING'])

    await logActivity({
      referenceId: referee.reference_id,
      action: 'LANDLORD_REFERENCE_RECEIVED',
      performedBy: 'referee',
      performedByType: 'referee',
      notes: `Landlord reference submitted`
    })

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
      .from('referees_v2')
      .select('id, referee_type, referee_email_encrypted, completed_at, reference_id')
      .eq('form_token_hash', hash(token))
      .eq('referee_type', 'ACCOUNTANT')
      .maybeSingle()

    if (error || !referee) {
      return res.status(404).json({ error: 'Reference not found or link expired' })
    }

    const { data: ref } = await supabase
      .from('tenant_references_v2')
      .select('id, tenant_first_name_encrypted, tenant_last_name_encrypted, company_id')
      .eq('id', referee.reference_id)
      .single()

    if (!ref) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    const { data: company } = await supabase
      .from('companies')
      .select('*')
      .eq('id', ref.company_id)
      .maybeSingle()

    const acCo = company as any
    return res.json({
      reference: {
        id: referee.id,
        client_name: `${decrypt(ref.tenant_first_name_encrypted) || ''} ${decrypt(ref.tenant_last_name_encrypted) || ''}`.trim(),
        submitted_at: referee.completed_at
      },
      companyName: acCo?.name || (acCo?.name_encrypted ? decrypt(acCo.name_encrypted) : null) || acCo?.company_name || 'A letting agent',
      companyLogo: acCo?.logo_url || ''
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
      .from('referees_v2')
      .select('id, reference_id, completed_at')
      .eq('form_token_hash', hash(token))
      .eq('referee_type', 'ACCOUNTANT')
      .single()

    if (rError || !referee) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    if (referee.completed_at) {
      return res.status(400).json({ error: 'Form has already been submitted' })
    }

    const { error: updateError } = await supabase
      .from('referees_v2')
      .update({
        referee_name: formData.accountantName,
        form_data: {
          ...formData,
          submittedAt: new Date().toISOString()
        },
        completed_at: new Date().toISOString()
      })
      .eq('id', referee.id)

    if (updateError) {
      console.error('Error submitting accountant form:', updateError)
      return res.status(500).json({ error: 'Failed to submit reference' })
    }

    // Move INCOME section to READY — accountant submitted their form, verify staff need to see it
    const { data: accIncSection } = await supabase
      .from('reference_sections_v2')
      .select('id, section_data')
      .eq('reference_id', referee.reference_id)
      .eq('section_type', 'INCOME')
      .eq('queue_status', 'PENDING')
      .maybeSingle()

    if (accIncSection) {
      const now = new Date().toISOString()
      await supabase
        .from('reference_sections_v2')
        .update({
          queue_status: 'READY',
          referee_submitted_at: now,
          queue_entered_at: now,
          section_data: {
            ...(accIncSection.section_data || {}),
            evidence_status: 'REFEREE_RECEIVED',
            accountant_reference_received: true,
            accountant_reference_received_at: now
          },
          updated_at: now
        })
        .eq('id', accIncSection.id)

      await logActivity({
        referenceId: referee.reference_id,
        sectionId: accIncSection.id,
        action: 'INCOME_MOVED_TO_READY',
        performedBy: 'system',
        performedByType: 'system',
        notes: `Accountant reference submitted — INCOME section moved to READY for verification`
      })
    }

    // Resolve any chase items for this referee
    await supabase
      .from('chase_items_v2')
      .update({
        status: 'RECEIVED',
        resolved_at: new Date().toISOString()
      })
      .eq('reference_id', referee.reference_id)
      .eq('referee_type', 'ACCOUNTANT')
      .in('status', ['IN_CHASE_QUEUE', 'WAITING'])

    await logActivity({
      referenceId: referee.reference_id,
      action: 'ACCOUNTANT_REFERENCE_RECEIVED',
      performedBy: 'referee',
      performedByType: 'referee',
      notes: `Accountant reference submitted`
    })

    return res.json({ success: true })
  } catch (error) {
    console.error('Error submitting accountant form:', error)
    return res.status(500).json({ error: 'Failed to submit reference' })
  }
})

export default router
