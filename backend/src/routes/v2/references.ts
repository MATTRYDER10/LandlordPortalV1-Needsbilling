/**
 * V2 References Routes
 *
 * Endpoints for creating and managing V2 references.
 * These routes only work for companies with V2 enabled.
 */

import { Router } from 'express'
import { authenticateToken, AuthRequest, getCompanyIdForRequest } from '../../middleware/auth'
import { decrypt, generateToken, hash } from '../../services/encryption'
import {
  shouldUseV2,
  createReference,
  getReference,
  getCompanyReferences,
  getReferenceDecrypted,
  updateReferenceStatus,
  updateRentShare,
  getGroupChildren,
  getGuarantor
} from '../../services/v2/referenceServiceV2'
import { getSections } from '../../services/v2/sectionServiceV2'
import { V2ReferenceStatus, CreateV2ReferenceInput } from '../../services/v2/types'
import { auditReferenceStarted, auditReferenceCompleted } from '../../services/propertyAuditService'
import { supabase } from '../../config/supabase'
import { sendTenantReferenceRequest, sendLandlordReferenceSummary } from '../../services/emailService'
import { getV2FrontendUrl } from '../../utils/frontendUrl'
import { refundCredits } from '../../services/creditService'

const router = Router()

// ============================================================================
// REFERENCE CRUD
// ============================================================================

/**
 * Create a new V2 reference (supports single tenant or multiple tenants)
 */
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) {
      return res.status(400).json({ error: 'Company ID required' })
    }

    // Check V2 is enabled for this company
    const isV2Enabled = await shouldUseV2(companyId)
    if (!isV2Enabled) {
      return res.status(400).json({ error: 'V2 references not enabled for this company' })
    }

    const {
      // Property fields (snake_case from new frontend format)
      property_address,
      property_city,
      property_postcode,
      monthly_rent,
      move_in_date,
      tenants, // New format: array of tenants
      holding_deposit_amount,
      offer_id,

      // Legacy fields (camelCase)
      linkedPropertyId,
      propertyAddress,
      propertyCity,
      propertyPostcode,
      monthlyRent,
      rentShare,
      moveInDate,
      termYears,
      termMonths,
      billsIncluded,
      tenantFirstName,
      tenantLastName,
      tenantEmail,
      tenantPhone,
      tenantDob,
      isGuarantor,
      guarantorForReferenceId,
      parentReferenceId,
      isGroupParent
    } = req.body

    // Support both new format (tenants array) and legacy format
    if (tenants && Array.isArray(tenants) && tenants.length > 0) {
      // New multi-tenant format
      const propAddress = property_address || propertyAddress
      const propCity = property_city || propertyCity
      const propPostcode = property_postcode || propertyPostcode
      const rent = monthly_rent || monthlyRent
      const moveDate = move_in_date || moveInDate || new Date().toISOString().split('T')[0]

      if (!propAddress || !propCity) {
        return res.status(400).json({ error: 'Property address and city required' })
      }
      if (!rent || rent <= 0) {
        return res.status(400).json({ error: 'Valid monthly rent required' })
      }

      // Handle property linking - use provided ID or auto-create
      let propertyIdToLink = linkedPropertyId
      if (!propertyIdToLink && propAddress && propPostcode) {
        // Import property matching service for auto-creation
        const { matchOrCreateProperty } = await import('../../services/propertyMatchingService')
        const matchResult = await matchOrCreateProperty(companyId, {
          line1: propAddress,
          city: propCity,
          postcode: propPostcode
        }, {
          autoCreate: true,
          userId: req.user?.id
        })
        if (matchResult.property_id) {
          propertyIdToLink = matchResult.property_id
        }
      }

      const createdReferences = []
      const isGroup = tenants.length > 1
      let parentRefId: string | null = null

      for (let i = 0; i < tenants.length; i++) {
        const tenant = tenants[i]

        if (!tenant.first_name || !tenant.last_name || !tenant.email) {
          return res.status(400).json({ error: `Tenant ${i + 1}: name and email required` })
        }

        const input: CreateV2ReferenceInput = {
          companyId,
          linkedPropertyId: propertyIdToLink,
          propertyAddress: propAddress,
          propertyCity: propCity,
          propertyPostcode: propPostcode || '',
          monthlyRent: parseFloat(rent),
          rentShare: tenant.rent_share ? parseFloat(tenant.rent_share) : parseFloat(rent),
          moveInDate: moveDate,
          termYears: termYears ? parseInt(termYears) : undefined,
          termMonths: termMonths ? parseInt(termMonths) : undefined,
          billsIncluded: billsIncluded || false,
          tenantFirstName: tenant.first_name,
          tenantLastName: tenant.last_name,
          tenantEmail: tenant.email,
          tenantPhone: tenant.phone || '',
          isGuarantor: false,
          parentReferenceId: parentRefId || undefined,
          isGroupParent: isGroup && i === 0,
          createdBy: req.user?.id,
          holdingDepositAmount: holding_deposit_amount ? parseFloat(holding_deposit_amount) : undefined,
          offerId: offer_id || undefined
        }

        const reference = await createReference(input)
        if (!reference) {
          return res.status(500).json({ error: `Failed to create reference for tenant ${i + 1}` })
        }

        // Log property audit for reference started
        if (propertyIdToLink) {
          try {
            const tenantName = `${tenant.first_name} ${tenant.last_name}`.trim()
            await auditReferenceStarted(propertyIdToLink, companyId, req.user?.id || '', tenantName, reference.id)
          } catch (auditError) {
            console.error('[V2 References] Failed to log reference started audit:', auditError)
          }
        }

        // First tenant in group becomes the parent
        if (isGroup && i === 0) {
          parentRefId = reference.id
        }

        createdReferences.push(reference)
      }

      // Get company details for email branding
      const { data: company } = await supabase
        .from('companies')
        .select('name_encrypted, phone_encrypted, email_encrypted, logo_url')
        .eq('id', companyId)
        .single()

      const companyName = company?.name_encrypted ? (decrypt(company.name_encrypted) || 'PropertyGoose') : 'PropertyGoose'
      const companyPhone = company?.phone_encrypted ? (decrypt(company.phone_encrypted) || '') : ''
      const companyEmail = company?.email_encrypted ? (decrypt(company.email_encrypted) || '') : ''
      const companyLogoUrl = company?.logo_url || null
      const frontendUrl = getV2FrontendUrl()

      // Send emails to each tenant
      for (let i = 0; i < tenants.length; i++) {
        const tenant = tenants[i]
        const reference = createdReferences[i]

        if (reference && (reference as any)._formToken) {
          const referenceLink = `${frontendUrl}/submit-reference-v2/${(reference as any)._formToken}`
          const tenantName = `${tenant.first_name} ${tenant.last_name}`.trim()

          try {
            await sendTenantReferenceRequest(
              tenant.email,
              tenantName,
              referenceLink,
              companyName,
              propAddress,
              companyPhone || undefined,
              companyEmail || undefined,
              reference.id,
              companyLogoUrl
            )
            console.log(`[V2 References] Sent reference email to ${tenant.email}`)
          } catch (emailError: any) {
            console.error(`[V2 References] Failed to send email to ${tenant.email}:`, emailError.message)
            // Don't fail the request - email is non-critical
          }
        }
      }

      res.status(201).json({
        references: createdReferences,
        count: createdReferences.length,
        message: `${createdReferences.length} V2 reference(s) created and emails sent`
      })
    } else {
      // Legacy single-tenant format
      if (!tenantFirstName || !tenantLastName || !tenantEmail) {
        return res.status(400).json({ error: 'Tenant name and email required' })
      }

      const rent = monthlyRent || monthly_rent
      if (!rent || rent <= 0) {
        return res.status(400).json({ error: 'Valid monthly rent required' })
      }

      const moveDate = moveInDate || move_in_date
      if (!moveDate) {
        return res.status(400).json({ error: 'Move-in date required' })
      }

      // Handle property linking - use provided ID or auto-create
      const propAddress = propertyAddress || property_address
      const propCity = propertyCity || property_city
      const propPostcode = propertyPostcode || property_postcode

      let propertyIdToLink = linkedPropertyId
      if (!propertyIdToLink && propAddress && propPostcode) {
        const { matchOrCreateProperty } = await import('../../services/propertyMatchingService')
        const matchResult = await matchOrCreateProperty(companyId, {
          line1: propAddress,
          city: propCity || '',
          postcode: propPostcode
        }, {
          autoCreate: true,
          userId: req.user?.id
        })
        if (matchResult.property_id) {
          propertyIdToLink = matchResult.property_id
        }
      }

      const input: CreateV2ReferenceInput = {
        companyId,
        linkedPropertyId: propertyIdToLink,
        propertyAddress: propAddress,
        propertyCity: propCity,
        propertyPostcode: propPostcode,
        monthlyRent: parseFloat(rent),
        rentShare: rentShare ? parseFloat(rentShare) : undefined,
        moveInDate: moveDate,
        termYears: termYears ? parseInt(termYears) : undefined,
        termMonths: termMonths ? parseInt(termMonths) : undefined,
        billsIncluded: billsIncluded || false,
        tenantFirstName,
        tenantLastName,
        tenantEmail,
        tenantPhone,
        tenantDob,
        isGuarantor: isGuarantor || false,
        guarantorForReferenceId,
        parentReferenceId,
        isGroupParent: isGroupParent || false,
        createdBy: req.user?.id,
        holdingDepositAmount: holding_deposit_amount ? parseFloat(holding_deposit_amount) : undefined,
        offerId: offer_id || undefined
      }

      const reference = await createReference(input)
      if (!reference) {
        return res.status(500).json({ error: 'Failed to create reference' })
      }

      // Log property audit for reference started
      if (propertyIdToLink) {
        try {
          const tenantName = `${tenantFirstName} ${tenantLastName}`.trim()
          await auditReferenceStarted(propertyIdToLink, companyId, req.user?.id || '', tenantName, reference.id)
        } catch (auditError) {
          console.error('[V2 References] Failed to log reference started audit:', auditError)
        }
      }

      // Send email to tenant
      if ((reference as any)._formToken) {
        const { data: company } = await supabase
          .from('companies')
          .select('name_encrypted, phone_encrypted, email_encrypted, logo_url')
          .eq('id', companyId)
          .single()

        const companyName = company?.name_encrypted ? (decrypt(company.name_encrypted) || 'PropertyGoose') : 'PropertyGoose'
        const companyPhone = company?.phone_encrypted ? (decrypt(company.phone_encrypted) || '') : ''
        const companyEmail = company?.email_encrypted ? (decrypt(company.email_encrypted) || '') : ''
        const companyLogoUrl = company?.logo_url || null
        const frontendUrl = getV2FrontendUrl()

        const referenceLink = `${frontendUrl}/submit-reference-v2/${(reference as any)._formToken}`
        const tenantName = `${tenantFirstName} ${tenantLastName}`.trim()
        const propAddress = propertyAddress || property_address || ''

        try {
          await sendTenantReferenceRequest(
            tenantEmail,
            tenantName,
            referenceLink,
            companyName,
            propAddress,
            companyPhone || undefined,
            companyEmail || undefined,
            reference.id,
            companyLogoUrl
          )
          console.log(`[V2 References] Sent reference email to ${tenantEmail}`)
        } catch (emailError: any) {
          console.error(`[V2 References] Failed to send email to ${tenantEmail}:`, emailError.message)
        }
      }

      res.status(201).json({
        reference,
        message: 'V2 reference created and email sent'
      })
    }
  } catch (error: any) {
    console.error('[V2 References] Error creating reference:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Get V2 references for company
 */
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) {
      return res.status(400).json({ error: 'Company ID required' })
    }

    const { status, limit, offset, excludeChildren } = req.query

    const { references, total } = await getCompanyReferences(companyId, {
      status: status as V2ReferenceStatus | undefined,
      limit: limit ? parseInt(limit as string) : 50,
      offset: offset ? parseInt(offset as string) : 0,
      excludeChildren: excludeChildren === 'true'
    })

    // Decrypt fields and fetch sections for display
    const decryptedReferences = await Promise.all(references.map(async ref => {
      const sections = await getSections(ref.id)
      return {
        ...ref,
        tenant_first_name: decrypt(ref.tenant_first_name_encrypted),
        tenant_last_name: decrypt(ref.tenant_last_name_encrypted),
        tenant_email: decrypt(ref.tenant_email_encrypted),
        tenant_phone: decrypt(ref.tenant_phone_encrypted),
        property_address: decrypt(ref.property_address_encrypted),
        property_city: decrypt(ref.property_city_encrypted),
        property_postcode: decrypt(ref.property_postcode_encrypted),
        sections: sections || []
      }
    }))

    res.json({ references: decryptedReferences, total })
  } catch (error: any) {
    console.error('[V2 References] Error getting references:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Get single V2 reference with full details
 */
router.get('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    const { id } = req.params

    const result = await getReferenceDecrypted(id)
    if (!result) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    // Verify company access
    if (result.reference.company_id !== companyId) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Get sections
    const sections = await getSections(id)

    // Get children if group parent
    let children = null
    if (result.reference.is_group_parent) {
      children = await getGroupChildren(id)
    }

    // Get guarantor if exists
    const guarantor = await getGuarantor(id)

    res.json({
      ...result,
      sections,
      children,
      guarantor
    })
  } catch (error: any) {
    console.error('[V2 References] Error getting reference:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Update reference status
 */
router.patch('/:id/status', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    const { id } = req.params
    const { status, finalDecisionNotes, finalDecisionBy } = req.body

    // Verify ownership
    const reference = await getReference(id)
    if (!reference) {
      return res.status(404).json({ error: 'Reference not found' })
    }
    if (reference.company_id !== companyId) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Validate status
    const validStatuses: V2ReferenceStatus[] = [
      'SENT', 'COLLECTING_EVIDENCE', 'ACTION_REQUIRED',
      'ACCEPTED', 'ACCEPTED_WITH_GUARANTOR', 'ACCEPTED_ON_CONDITION', 'REJECTED'
    ]
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' })
    }

    const success = await updateReferenceStatus(id, status, {
      finalDecisionNotes,
      finalDecisionBy
    })

    if (!success) {
      return res.status(500).json({ error: 'Failed to update status' })
    }

    // Log property audit for terminal statuses
    const terminalStatuses = ['ACCEPTED', 'ACCEPTED_WITH_GUARANTOR', 'ACCEPTED_ON_CONDITION', 'REJECTED']
    if (terminalStatuses.includes(status) && reference.linked_property_id) {
      try {
        const tenantName = `${decrypt(reference.tenant_first_name_encrypted) || ''} ${decrypt(reference.tenant_last_name_encrypted) || ''}`.trim() || 'Tenant'
        await auditReferenceCompleted(reference.linked_property_id, companyId!, tenantName, id)
      } catch (auditError) {
        console.error('[V2 References] Failed to log property audit:', auditError)
      }
    }

    res.json({ message: 'Status updated', status })
  } catch (error: any) {
    console.error('[V2 References] Error updating status:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Update rent share
 */
router.patch('/:id/rent-share', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    const { id } = req.params
    const { rentShare } = req.body

    // Verify ownership
    const reference = await getReference(id)
    if (!reference) {
      return res.status(404).json({ error: 'Reference not found' })
    }
    if (reference.company_id !== companyId) {
      return res.status(403).json({ error: 'Access denied' })
    }

    if (typeof rentShare !== 'number' || rentShare < 0) {
      return res.status(400).json({ error: 'Valid rent share required' })
    }

    const success = await updateRentShare(id, rentShare)
    if (!success) {
      return res.status(500).json({ error: 'Failed to update rent share' })
    }

    // Get updated reference with affordability
    const updated = await getReference(id)

    res.json({
      message: 'Rent share updated',
      rentShare,
      affordabilityRatio: updated?.affordability_ratio,
      affordabilityPass: updated?.affordability_pass
    })
  } catch (error: any) {
    console.error('[V2 References] Error updating rent share:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Send reference summary to landlord
 */
router.post('/:id/send-to-landlord', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    const { id } = req.params
    const { landlordEmail: manualLandlordEmail } = req.body

    if (!companyId) {
      return res.status(400).json({ error: 'Company ID required' })
    }

    // Get reference with full details
    const result = await getReferenceDecrypted(id)
    if (!result) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    // Verify company access
    if (result.reference.company_id !== companyId) {
      return res.status(403).json({ error: 'Access denied' })
    }

    const reference = result.reference

    // Get landlord email - either from linked property or manual input
    let landlordEmail = manualLandlordEmail
    let landlordName = 'Landlord'

    if (!landlordEmail && reference.linked_property_id) {
      // Try to get landlord from property_landlords -> landlords
      const { data: propertyLandlords } = await supabase
        .from('property_landlords')
        .select(`
          landlord_id,
          is_primary_contact,
          landlord:landlords (
            id,
            first_name_encrypted,
            last_name_encrypted,
            email_encrypted
          )
        `)
        .eq('property_id', reference.linked_property_id)
        .order('is_primary_contact', { ascending: false })
        .limit(1)

      if (propertyLandlords && propertyLandlords.length > 0) {
        const landlord = propertyLandlords[0].landlord as any
        if (landlord) {
          landlordEmail = decrypt(landlord.email_encrypted)
          const firstName = decrypt(landlord.first_name_encrypted) || ''
          const lastName = decrypt(landlord.last_name_encrypted) || ''
          landlordName = `${firstName} ${lastName}`.trim() || 'Landlord'
        }
      }
    }

    if (!landlordEmail) {
      return res.status(400).json({
        error: 'No landlord email found. Please provide a manual email address.',
        requiresManualEmail: true
      })
    }

    // Get company details
    const { data: company } = await supabase
      .from('companies')
      .select('name_encrypted, logo_url')
      .eq('id', companyId)
      .single()

    const companyName = company?.name_encrypted ? (decrypt(company.name_encrypted) || 'PropertyGoose') : 'PropertyGoose'
    const companyLogoUrl = company?.logo_url || null

    // Get first name from tenant name (result.tenantName contains full name)
    const tenantFirstName = result.tenantName?.split(' ')[0] || 'Tenant'

    // Get job title from reference (if available)
    const jobTitle = reference.job_title_encrypted ? decrypt(reference.job_title_encrypted) : undefined

    // Build tenant data (first name only, job info, salary - NO contact details)
    const tenants = [{
      firstName: tenantFirstName,
      jobTitle: jobTitle || undefined,
      annualIncome: reference.annual_income || undefined,
      rentShare: reference.rent_share || undefined
    }]

    // Get children if group parent
    if (reference.is_group_parent) {
      const children = await getGroupChildren(id)
      if (children && children.length > 0) {
        for (const child of children) {
          const childDecrypted = await getReferenceDecrypted(child.id)
          if (childDecrypted) {
            const childFirstName = childDecrypted.tenantName?.split(' ')[0] || 'Tenant'
            const childJobTitle = child.job_title_encrypted ? decrypt(child.job_title_encrypted) : undefined

            tenants.push({
              firstName: childFirstName,
              jobTitle: childJobTitle || undefined,
              annualIncome: child.annual_income || undefined,
              rentShare: child.rent_share || undefined
            })
          }
        }
      }
    }

    // Send email
    await sendLandlordReferenceSummary(
      landlordEmail,
      landlordName,
      result.propertyAddress || '',
      reference.monthly_rent || 0,
      reference.move_in_date || '',
      tenants,
      reference.status || 'PENDING',
      companyName,
      companyLogoUrl
    )

    res.json({
      message: 'Reference summary sent to landlord',
      sentTo: landlordEmail
    })
  } catch (error: any) {
    console.error('[V2 References] Error sending to landlord:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Get landlord email for a reference (from linked property)
 */
router.get('/:id/landlord-email', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    const { id } = req.params

    if (!companyId) {
      return res.status(400).json({ error: 'Company ID required' })
    }

    // Get reference
    const reference = await getReference(id)
    if (!reference) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    // Verify company access
    if (reference.company_id !== companyId) {
      return res.status(403).json({ error: 'Access denied' })
    }

    if (!reference.linked_property_id) {
      return res.json({ hasLandlord: false, email: null, name: null })
    }

    // Get landlord from property_landlords -> landlords
    const { data: propertyLandlords } = await supabase
      .from('property_landlords')
      .select(`
        landlord_id,
        is_primary_contact,
        landlord:landlords (
          id,
          first_name_encrypted,
          last_name_encrypted,
          email_encrypted
        )
      `)
      .eq('property_id', reference.linked_property_id)
      .order('is_primary_contact', { ascending: false })
      .limit(1)

    if (!propertyLandlords || propertyLandlords.length === 0) {
      return res.json({ hasLandlord: false, email: null, name: null })
    }

    const landlord = propertyLandlords[0].landlord as any
    if (!landlord) {
      return res.json({ hasLandlord: false, email: null, name: null })
    }

    const email = decrypt(landlord.email_encrypted)
    const firstName = decrypt(landlord.first_name_encrypted) || ''
    const lastName = decrypt(landlord.last_name_encrypted) || ''
    const name = `${firstName} ${lastName}`.trim()

    res.json({
      hasLandlord: !!email,
      email: email || null,
      name: name || null
    })
  } catch (error: any) {
    console.error('[V2 References] Error getting landlord email:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Resend reference request email to tenant
 */
router.post('/:id/resend-email', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    const { id } = req.params

    if (!companyId) {
      return res.status(400).json({ error: 'Company ID required' })
    }

    // Get reference with decrypted details
    const result = await getReferenceDecrypted(id)
    if (!result) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    const reference = result.reference

    // Verify company access
    if (reference.company_id !== companyId) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Check reference is in a state where resending makes sense
    const validStatuses = ['SENT', 'COLLECTING_EVIDENCE', 'ACTION_REQUIRED']
    if (!validStatuses.includes(reference.status)) {
      return res.status(400).json({ error: 'Cannot resend email for this reference status' })
    }

    // Get tenant email
    const tenantEmail = result.tenantEmail
    if (!tenantEmail) {
      return res.status(400).json({ error: 'No tenant email found' })
    }

    // Get company details
    const { data: company } = await supabase
      .from('companies')
      .select('name, logo_url, phone_encrypted, email_encrypted')
      .eq('id', companyId)
      .single()

    const companyName = company?.name || 'PropertyGoose'
    const companyPhone = company?.phone_encrypted ? decrypt(company.phone_encrypted) || '' : ''
    const companyEmail = company?.email_encrypted ? decrypt(company.email_encrypted) || '' : ''
    const companyLogoUrl = company?.logo_url || null

    // Generate new token for resending (old token cannot be recovered from hash)
    const newToken = generateToken()
    const newTokenHash = hash(newToken)

    console.log('[V2 References] Resend - New token hash:', newTokenHash.substring(0, 16) + '...')

    // Update the token hash in the database
    const { error: updateError } = await supabase
      .from('tenant_references_v2')
      .update({
        form_token_hash: newTokenHash,
        sent_at: new Date().toISOString()
      })
      .eq('id', id)

    if (updateError) {
      console.error('[V2 References] Failed to update token:', updateError)
      return res.status(500).json({ error: 'Failed to update reference token' })
    }

    console.log('[V2 References] Token updated for reference:', id)

    // Build form URL using new token
    const formUrl = `${getV2FrontendUrl()}/submit-reference-v2/${newToken}`

    // Get tenant name
    const tenantName = result.tenantName || 'Tenant'

    // Send email (correct parameter order)
    await sendTenantReferenceRequest(
      tenantEmail,
      tenantName,
      formUrl,
      companyName,
      result.propertyAddress || undefined,
      companyPhone || undefined,
      companyEmail || undefined,
      id,
      companyLogoUrl
    )

    res.json({
      message: 'Reference request email resent',
      sentTo: tenantEmail
    })
  } catch (error: any) {
    console.error('[V2 References] Error resending email:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Delete a V2 reference
 * - If tenant has NOT submitted form: refund credit
 * - If tenant HAS submitted form: no refund (credit already used for checks)
 */
router.delete('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    const { id } = req.params

    if (!companyId) {
      return res.status(400).json({ error: 'Company ID required' })
    }

    // Get the reference
    const reference = await getReference(id)
    if (!reference) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    // Verify company access
    if (reference.company_id !== companyId) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Check if tenant has submitted the form
    const formSubmitted = !!reference.form_submitted_at

    // Delete associated sections first
    const { error: sectionsError } = await supabase
      .from('reference_sections_v2')
      .delete()
      .eq('reference_id', id)

    if (sectionsError) {
      console.error('[V2 References] Error deleting sections:', sectionsError)
    }

    // Delete any referees
    const { error: refereesError } = await supabase
      .from('referees_v2')
      .delete()
      .eq('reference_id', id)

    if (refereesError) {
      console.error('[V2 References] Error deleting referees:', refereesError)
    }

    // Delete the reference
    const { error: deleteError } = await supabase
      .from('tenant_references_v2')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('[V2 References] Error deleting reference:', deleteError)
      return res.status(500).json({ error: 'Failed to delete reference' })
    }

    // Refund credit if form was NOT submitted
    let creditRefunded = false
    if (!formSubmitted) {
      try {
        await refundCredits(
          companyId,
          1,
          id,
          'Reference deleted before tenant submission',
          req.user?.id
        )
        creditRefunded = true
        console.log('[V2 References] Credit refunded for deleted reference:', id)
      } catch (refundError) {
        console.error('[V2 References] Error refunding credit:', refundError)
        // Continue anyway - reference is already deleted
      }
    }

    res.json({
      message: 'Reference deleted successfully',
      creditRefunded,
      formWasSubmitted: formSubmitted
    })
  } catch (error: any) {
    console.error('[V2 References] Error deleting reference:', error)
    res.status(500).json({ error: error.message })
  }
})

export default router
