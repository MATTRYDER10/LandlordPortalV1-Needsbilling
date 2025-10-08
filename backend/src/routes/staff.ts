import { Router } from 'express'
import { authenticateStaff, StaffAuthRequest } from '../middleware/staffAuth'
import { supabase } from '../config/supabase'
import { decrypt } from '../services/encryption'

const router = Router()

// Get all references across all companies (for staff dashboard)
router.get('/references', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    const { status, company_id, search } = req.query

    let query = supabase
      .from('tenant_references')
      .select(`
        *,
        companies:company_id (
          id,
          name_encrypted
        )
      `)
      .neq('is_group_parent', true) // Exclude parent multi-tenant references from staff view
      .order('created_at', { ascending: false })

    // Filter by status if provided
    if (status && typeof status === 'string') {
      query = query.eq('status', status)
    }

    // Filter by company if provided
    if (company_id && typeof company_id === 'string') {
      query = query.eq('company_id', company_id)
    }

    // Search by tenant name or email
    if (search && typeof search === 'string') {
      query = query.or(`tenant_first_name.ilike.%${search}%,tenant_last_name.ilike.%${search}%,tenant_email.ilike.%${search}%`)
    }

    const { data: references, error } = await query

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    // Decrypt tenant reference fields for list view
    const decryptedReferences = references?.map(ref => ({
      ...ref,
      companies: ref.companies ? {
        ...ref.companies,
        name: decrypt(ref.companies.name_encrypted)
      } : null,
      tenant_first_name: decrypt(ref.tenant_first_name_encrypted),
      tenant_last_name: decrypt(ref.tenant_last_name_encrypted),
      tenant_email: decrypt(ref.tenant_email_encrypted),
      tenant_phone: decrypt(ref.tenant_phone_encrypted),
      property_address: decrypt(ref.property_address_encrypted),
      property_city: decrypt(ref.property_city_encrypted),
      property_postcode: decrypt(ref.property_postcode_encrypted)
    }))

    res.json({ references: decryptedReferences })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Get single reference with full details
router.get('/references/:id', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    const { id } = req.params

    // Get reference
    const { data: reference, error: refError } = await supabase
      .from('tenant_references')
      .select(`
        *,
        companies:company_id (
          id,
          name_encrypted
        )
      `)
      .eq('id', id)
      .single()

    if (refError || !reference) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    // Get landlord reference if exists
    let { data: landlordReference } = await supabase
      .from('landlord_references')
      .select('*')
      .eq('reference_id', id)
      .single()

    // Get agent reference if exists
    let { data: agentReference } = await supabase
      .from('agent_references')
      .select('*')
      .eq('reference_id', id)
      .single()

    // Get employer reference if exists
    const { data: employerReference } = await supabase
      .from('employer_references')
      .select('*')
      .eq('reference_id', id)
      .single()

    // Get accountant reference if exists
    let { data: accountantReference } = await supabase
      .from('accountant_references')
      .select('*')
      .eq('tenant_reference_id', id)
      .single()

    // If this is a child reference and no landlord/agent/accountant ref found, check siblings
    if (reference.parent_reference_id && (!landlordReference && !agentReference && !accountantReference)) {
      // Get all sibling references
      const { data: siblings } = await supabase
        .from('tenant_references')
        .select('id')
        .eq('parent_reference_id', reference.parent_reference_id)
        .neq('id', id)

      if (siblings && siblings.length > 0) {
        // Check each sibling for references
        for (const sibling of siblings) {
          if (!landlordReference) {
            const { data: siblingLandlordRef } = await supabase
              .from('landlord_references')
              .select('*')
              .eq('reference_id', sibling.id)
              .single()
            if (siblingLandlordRef) landlordReference = siblingLandlordRef
          }

          if (!agentReference) {
            const { data: siblingAgentRef } = await supabase
              .from('agent_references')
              .select('*')
              .eq('reference_id', sibling.id)
              .single()
            if (siblingAgentRef) agentReference = siblingAgentRef
          }

          if (!accountantReference) {
            const { data: siblingAccountantRef } = await supabase
              .from('accountant_references')
              .select('*')
              .eq('tenant_reference_id', sibling.id)
              .single()
            if (siblingAccountantRef) accountantReference = siblingAccountantRef
          }

          // Break early if we found all references
          if (landlordReference && agentReference && accountantReference) break
        }
      }
    }

    // Get documents
    const { data: documents } = await supabase
      .from('reference_documents')
      .select('*')
      .eq('reference_id', id)

    // Helper function to decrypt tenant reference fields
    const decryptTenantReference = (ref: any) => {
      if (!ref) return ref
      return {
        ...ref,
        companies: ref.companies ? {
          ...ref.companies,
          name: decrypt(ref.companies.name_encrypted)
        } : null,
        tenant_first_name: decrypt(ref.tenant_first_name_encrypted),
        tenant_last_name: decrypt(ref.tenant_last_name_encrypted),
        tenant_email: decrypt(ref.tenant_email_encrypted),
        tenant_phone: decrypt(ref.tenant_phone_encrypted),
        contact_number: decrypt(ref.contact_number_encrypted),
        date_of_birth: decrypt(ref.date_of_birth_encrypted),
        property_address: decrypt(ref.property_address_encrypted),
        property_city: decrypt(ref.property_city_encrypted),
        property_postcode: decrypt(ref.property_postcode_encrypted),
        current_address_line1: decrypt(ref.current_address_line1_encrypted),
        current_address_line2: decrypt(ref.current_address_line2_encrypted),
        current_city: decrypt(ref.current_city_encrypted),
        current_postcode: decrypt(ref.current_postcode_encrypted),
        current_country: decrypt(ref.current_country_encrypted),
        employment_company_name: decrypt(ref.employment_company_name_encrypted),
        employment_job_title: decrypt(ref.employment_position_encrypted),
        employment_salary_amount: decrypt(ref.employment_salary_amount_encrypted),
        employment_company_address_line1: decrypt(ref.employment_company_address_line1_encrypted),
        employment_company_address_line2: decrypt(ref.employment_company_address_line2_encrypted),
        employment_company_city: decrypt(ref.employment_company_city_encrypted),
        employment_company_postcode: decrypt(ref.employment_company_postcode_encrypted),
        employment_company_country: decrypt(ref.employment_company_country_encrypted),
        self_employed_annual_income: decrypt(ref.self_employed_annual_income_encrypted),
        savings_amount: decrypt(ref.savings_amount_encrypted),
        employer_ref_email: decrypt(ref.employer_ref_email_encrypted),
        employer_ref_phone: decrypt(ref.employer_ref_phone_encrypted),
        previous_landlord_name: decrypt(ref.previous_landlord_name_encrypted),
        previous_landlord_email: decrypt(ref.previous_landlord_email_encrypted),
        previous_landlord_phone: decrypt(ref.previous_landlord_phone_encrypted),
        previous_rental_address_line1: decrypt(ref.previous_rental_address_line1_encrypted),
        previous_rental_address_line2: decrypt(ref.previous_rental_address_line2_encrypted),
        previous_rental_city: decrypt(ref.previous_rental_city_encrypted),
        previous_rental_postcode: decrypt(ref.previous_rental_postcode_encrypted),
        previous_rental_country: decrypt(ref.previous_rental_country_encrypted),
        accountant_name: decrypt(ref.accountant_firm_encrypted),
        accountant_contact_name: decrypt(ref.accountant_name_encrypted),
        accountant_email: decrypt(ref.accountant_email_encrypted),
        accountant_phone: decrypt(ref.accountant_phone_encrypted)
      }
    }

    // Decrypt all reference data
    const decryptedReference = decryptTenantReference(reference)

    const decryptedLandlordReference = landlordReference ? {
      ...landlordReference,
      landlord_name: decrypt(landlordReference.landlord_name_encrypted),
      landlord_email: decrypt(landlordReference.landlord_email_encrypted),
      landlord_phone: decrypt(landlordReference.landlord_phone_encrypted),
      property_address: decrypt(landlordReference.property_address_encrypted),
      property_city: decrypt(landlordReference.property_city_encrypted),
      property_postcode: decrypt(landlordReference.property_postcode_encrypted),
      monthly_rent: decrypt(landlordReference.monthly_rent_encrypted),
      signature_name: decrypt(landlordReference.signature_name_encrypted),
      signature: decrypt(landlordReference.signature_encrypted)
    } : null

    const decryptedAgentReference = agentReference ? {
      ...agentReference,
      agent_name: decrypt(agentReference.agent_name_encrypted),
      agency_name: decrypt(agentReference.agency_name_encrypted),
      agent_email: decrypt(agentReference.agent_email_encrypted),
      agent_phone: decrypt(agentReference.agent_phone_encrypted),
      property_address: decrypt(agentReference.property_address_encrypted),
      property_city: decrypt(agentReference.property_city_encrypted),
      property_postcode: decrypt(agentReference.property_postcode_encrypted),
      monthly_rent: decrypt(agentReference.monthly_rent_encrypted),
      signature_name: decrypt(agentReference.signature_name_encrypted),
      signature: decrypt(agentReference.signature_encrypted)
    } : null

    const decryptedEmployerReference = employerReference ? {
      ...employerReference,
      company_name: decrypt(employerReference.company_name_encrypted),
      employer_name: decrypt(employerReference.employer_name_encrypted),
      employer_position: decrypt(employerReference.employer_position_encrypted),
      employer_email: decrypt(employerReference.employer_email_encrypted),
      employer_phone: decrypt(employerReference.employer_phone_encrypted),
      employee_position: decrypt(employerReference.employee_position_encrypted),
      annual_salary: decrypt(employerReference.annual_salary_encrypted),
      signature: decrypt(employerReference.signature_encrypted)
    } : null

    const decryptedAccountantReference = accountantReference ? {
      ...accountantReference,
      accountant_name: decrypt(accountantReference.accountant_name_encrypted),
      accountant_firm: decrypt(accountantReference.accountant_firm_encrypted),
      accountant_email: decrypt(accountantReference.accountant_email_encrypted),
      accountant_phone: decrypt(accountantReference.accountant_phone_encrypted),
      business_name: decrypt(accountantReference.business_name_encrypted),
      annual_turnover: decrypt(accountantReference.annual_turnover_encrypted),
      annual_profit: decrypt(accountantReference.annual_profit_encrypted),
      estimated_monthly_income: decrypt(accountantReference.estimated_monthly_income_encrypted),
      signature: decrypt(accountantReference.signature_encrypted)
    } : null

    res.json({
      reference: decryptedReference,
      landlordReference: decryptedLandlordReference,
      agentReference: decryptedAgentReference,
      employerReference: decryptedEmployerReference,
      accountantReference: decryptedAccountantReference,
      documents
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Verify and complete a reference
router.put('/references/:id/verify', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    const { id } = req.params
    const { notes } = req.body
    const staffUserId = req.staffUser?.id

    // Update reference status to completed
    const { data: reference, error } = await supabase
      .from('tenant_references')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        verified_by: staffUserId,
        verified_at: new Date().toISOString(),
        verification_notes: notes || null
      })
      .eq('id', id)
      .eq('status', 'pending_verification') // Only allow verification if status is pending_verification
      .select()
      .single()

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    if (!reference) {
      return res.status(404).json({ error: 'Reference not found or already verified' })
    }

    res.json({
      message: 'Reference verified successfully',
      reference
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Reject a reference (set back to in_progress for corrections)
router.put('/references/:id/reject', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    const { id } = req.params
    const { notes } = req.body
    const staffUserId = req.staffUser?.id

    if (!notes) {
      return res.status(400).json({ error: 'Rejection notes are required' })
    }

    // Update reference status to rejected
    const { data: reference, error } = await supabase
      .from('tenant_references')
      .update({
        status: 'rejected',
        verified_by: staffUserId,
        verified_at: new Date().toISOString(),
        verification_notes: notes
      })
      .eq('id', id)
      .eq('status', 'pending_verification')
      .select()
      .single()

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    if (!reference) {
      return res.status(404).json({ error: 'Reference not found or already processed' })
    }

    res.json({
      message: 'Reference rejected and sent back for corrections',
      reference
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Get staff dashboard stats
router.get('/stats', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    // Count references by status (excluding parent multi-tenant references)
    const { data: stats, error } = await supabase
      .from('tenant_references')
      .select('status')
      .neq('is_group_parent', true) // Exclude parent multi-tenant references from stats

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    const statusCounts = stats.reduce((acc: any, ref: any) => {
      acc[ref.status] = (acc[ref.status] || 0) + 1
      return acc
    }, {})

    res.json({ stats: statusCounts })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Download file from reference (staff authenticated route)
router.get('/download/:referenceId/:folder/:filename', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    const { referenceId, folder, filename } = req.params

    // Verify the reference exists (staff can access all references)
    const { data: reference, error: refError } = await supabase
      .from('tenant_references')
      .select('id')
      .eq('id', referenceId)
      .single()

    if (refError || !reference) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    // Construct file path
    const filePath = `${referenceId}/${folder}/${filename}`

    // Download file from storage
    const { data, error: downloadError } = await supabase.storage
      .from('tenant-documents')
      .download(filePath)

    if (downloadError) {
      return res.status(404).json({ error: 'File not found' })
    }

    // Set content type based on file extension
    const ext = filename.split('.').pop()?.toLowerCase()
    const contentTypes: { [key: string]: string } = {
      'pdf': 'application/pdf',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'webp': 'image/webp'
    }
    const contentType = contentTypes[ext || ''] || 'application/octet-stream'

    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`)

    // Convert blob to buffer and send
    const buffer = Buffer.from(await data.arrayBuffer())
    res.send(buffer)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

export default router
