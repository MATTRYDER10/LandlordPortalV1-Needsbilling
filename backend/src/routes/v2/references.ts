/**
 * V2 References Routes
 *
 * Endpoints for creating and managing V2 references.
 * These routes only work for companies with V2 enabled.
 */

import { Router } from 'express'
import { authenticateToken, AuthRequest, getCompanyIdForRequest } from '../../middleware/auth'
import { decrypt, encrypt, generateToken, hash } from '../../services/encryption'
import {
  shouldUseV2,
  createReference,
  getReference,
  getCompanyReferences,
  getReferenceDecrypted,
  updateReferenceStatus,
  updateRentShare,
  getGroupChildren,
  getGuarantor,
  editReferenceField
} from '../../services/v2/referenceServiceV2'
import { logActivity, getActivityForReference } from '../../services/v2/activityServiceV2'
import { deductCredits } from '../../services/creditService'
import { getSections } from '../../services/v2/sectionServiceV2'
import { V2ReferenceStatus, CreateV2ReferenceInput } from '../../services/v2/types'
import { auditReferenceStarted, auditReferenceCompleted } from '../../services/propertyAuditService'
import { supabase } from '../../config/supabase'
import { sendTenantReferenceRequest, sendLandlordReferenceSummary, sendEmail } from '../../services/emailService'
import { getV2FrontendUrl } from '../../utils/frontendUrl'
import { refundCredits } from '../../services/creditService'
import { creditsafeService } from '../../services/creditsafeService'
import { sanctionsService } from '../../services/sanctionsService'
import { updateSectionStatus } from '../../services/v2/sectionServiceV2'
import { validateV2Conversion, convertV2ReferenceToTenancy } from '../../services/v2/tenancyConversionServiceV2'

const router = Router()

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Decrypt sensitive fields in form_data for display
 * Encrypted fields: identity.phone, identity.dateOfBirth, rtr.shareCode,
 *                   income.employerAddress, guarantor.email, guarantor.phone, consent.signature
 */
function decryptFormData(formData: any): any {
  if (!formData) return null

  const decrypted = { ...formData }

  // Identity section
  if (decrypted.identity) {
    decrypted.identity = { ...decrypted.identity }
    if (decrypted.identity.phone) {
      try {
        decrypted.identity.phone = decrypt(decrypted.identity.phone)
      } catch (e) {
        // Already decrypted or invalid
      }
    }
    if (decrypted.identity.dateOfBirth) {
      try {
        decrypted.identity.dateOfBirth = decrypt(decrypted.identity.dateOfBirth)
      } catch (e) {
        // Already decrypted or invalid
      }
    }
  }

  // RTR section
  if (decrypted.rtr) {
    decrypted.rtr = { ...decrypted.rtr }
    if (decrypted.rtr.shareCode) {
      try {
        decrypted.rtr.shareCode = decrypt(decrypted.rtr.shareCode)
      } catch (e) {
        // Already decrypted or invalid
      }
    }
  }

  // Income section
  if (decrypted.income) {
    decrypted.income = { ...decrypted.income }
    if (decrypted.income.employerAddress) {
      try {
        decrypted.income.employerAddress = decrypt(decrypted.income.employerAddress)
      } catch (e) {
        // Already decrypted or invalid
      }
    }
  }

  // Guarantor section
  if (decrypted.guarantor) {
    decrypted.guarantor = { ...decrypted.guarantor }
    if (decrypted.guarantor.email) {
      try {
        decrypted.guarantor.email = decrypt(decrypted.guarantor.email)
      } catch (e) {
        // Already decrypted or invalid
      }
    }
    if (decrypted.guarantor.phone) {
      try {
        decrypted.guarantor.phone = decrypt(decrypted.guarantor.phone)
      } catch (e) {
        // Already decrypted or invalid
      }
    }
  }

  // Consent section - decrypt signature for display (though typically not shown)
  if (decrypted.consent) {
    decrypted.consent = { ...decrypted.consent }
    if (decrypted.consent.signature) {
      try {
        decrypted.consent.signature = decrypt(decrypted.consent.signature)
      } catch (e) {
        // Already decrypted or invalid
      }
    }
  }

  return decrypted
}

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
      isGroupParent,
      depositReplacementOffered
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
          rentShare: tenant.rent_share ? parseFloat(tenant.rent_share) : (isGroup ? Math.round(parseFloat(rent) / tenants.length * 100) / 100 : parseFloat(rent)),
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
          offerId: offer_id || undefined,
          depositReplacementOffered: depositReplacementOffered || false
        }

        const reference = await createReference(input)
        if (!reference) {
          return res.status(500).json({ error: `Failed to create reference for tenant ${i + 1}` })
        }

        // Deduct 1 credit for tenant reference
        try {
          await deductCredits(companyId, 1, reference.id, `V2 tenant reference: ${tenant.first_name} ${tenant.last_name}`, req.user?.id)
          console.log(`[V2 References] Deducted 1 credit for tenant ${tenant.first_name} ${tenant.last_name}`)
        } catch (creditError: any) {
          console.error(`[V2 References] Credit deduction failed:`, creditError.message)
          // Don't fail the request - reference is already created
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

      // Update linked offer status to 'holding_deposit_received' (referencing)
      if (offer_id && createdReferences.length > 0) {
        try {
          const { error: offerUpdateError } = await supabase
            .from('tenant_offers')
            .update({
              status: 'holding_deposit_received',
              holding_deposit_received_at: new Date().toISOString()
            })
            .eq('id', offer_id)
          if (offerUpdateError) {
            console.error('[V2 References] Failed to update offer status:', offerUpdateError.message)
          } else {
            console.log('[V2 References] Offer', offer_id, 'marked as referencing')
          }
        } catch (err) {
          console.error('[V2 References] Error updating offer:', err)
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

    // Batch fetch all sections for all references in one query
    const refIds = references.map(r => r.id)
    const { data: allSections } = refIds.length > 0
      ? await supabase
          .from('reference_sections_v2')
          .select('id, reference_id, section_type, queue_status, decision, assessor_notes, completed_at, section_data')
          .in('reference_id', refIds)
      : { data: [] }

    // Group sections by reference_id
    const sectionsByRef = new Map<string, any[]>()
    for (const s of (allSections || [])) {
      const arr = sectionsByRef.get(s.reference_id) || []
      arr.push(s)
      sectionsByRef.set(s.reference_id, arr)
    }

    // Batch fetch offer data (UniHomes + deposit replacement) from linked offers
    const offerIds = [...new Set(references.map(r => r.offer_id).filter(Boolean))]
    const offerDataMap = new Map<string, { unihomes_offered: boolean; unihomes_interested: boolean; deposit_replacement_offered: boolean; deposit_replacement_requested: boolean }>()
    if (offerIds.length > 0) {
      const { data: offers } = await supabase
        .from('tenant_offers')
        .select('id, unihomes_offered, unihomes_interested, deposit_replacement_offered, deposit_replacement_requested')
        .in('id', offerIds)
      for (const o of (offers || [])) {
        offerDataMap.set(o.id, { unihomes_offered: o.unihomes_offered, unihomes_interested: o.unihomes_interested, deposit_replacement_offered: o.deposit_replacement_offered, deposit_replacement_requested: o.deposit_replacement_requested })
      }
    }

    // Decrypt fields (sync - no extra DB calls)
    const decryptedReferences = references.map(ref => {
      const offerData = ref.offer_id ? offerDataMap.get(ref.offer_id) : null
      return {
        ...ref,
        tenant_first_name: decrypt(ref.tenant_first_name_encrypted),
        tenant_last_name: decrypt(ref.tenant_last_name_encrypted),
        tenant_email: decrypt(ref.tenant_email_encrypted),
        tenant_phone: decrypt(ref.tenant_phone_encrypted),
        property_address: decrypt(ref.property_address_encrypted),
        property_city: decrypt(ref.property_city_encrypted),
        property_postcode: decrypt(ref.property_postcode_encrypted),
        form_data: decryptFormData(ref.form_data),
        sections: sectionsByRef.get(ref.id) || [],
        has_open_issues: (sectionsByRef.get(ref.id) || []).some((s: any) => {
          const issueStatus = s.section_data?.issue_status
          return issueStatus === 'OPEN' || issueStatus === 'RESPONSE_PENDING_REVIEW'
        }),
        offer_unihomes: offerData?.unihomes_offered || false,
        unihomes_interested: offerData?.unihomes_interested || false,
        deposit_replacement_offered: offerData?.deposit_replacement_offered || ref.deposit_replacement_offered || false,
        deposit_replacement_requested: offerData?.deposit_replacement_requested || false
      }
    })

    res.json({ references: decryptedReferences, total })
  } catch (error: any) {
    console.error('[V2 References] Error getting references:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/v2/references/calendar
 * Upcoming move-in dates drawn from BOTH V1 and V2 references for the
 * dashboard calendar. One entry per reference (groups collapse to a single
 * row). Guarantors are excluded. Any reference with a move_in_date in the
 * next 12 months is returned, regardless of status, so the calendar
 * reflects the true pipeline — not just converted tenancies.
 *
 * Each entry is tagged with referenceVersion ('v1' | 'v2') so the frontend
 * can route clicks to the correct page (/references vs /references-v2).
 */
router.get('/calendar', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) {
      return res.status(400).json({ error: 'Company ID required' })
    }

    const now = new Date()
    const endDate = new Date(now.getFullYear(), now.getMonth() + 12, 0)
    const endDateStr = endDate.toISOString().split('T')[0]
    // Start from the 1st of the current month so move-ins earlier this
    // month still appear in the calendar (not just future dates)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const startDateStr = monthStart.toISOString().split('T')[0]

    // Helper to take a flat list of references and collapse group children
    // into their parent — same logic for V1 and V2 since both use the same
    // parent_reference_id / is_group_parent shape.
    const collapseGroups = (rows: any[]) => {
      const parentById = new Map<string, any>()
      const childrenByParent = new Map<string, any[]>()
      for (const r of rows) {
        if (r.parent_reference_id && !r.is_group_parent) {
          const arr = childrenByParent.get(r.parent_reference_id) || []
          arr.push(r)
          childrenByParent.set(r.parent_reference_id, arr)
        } else {
          parentById.set(r.id, r)
        }
      }
      return { parentById, childrenByParent }
    }

    // Helper to convert a reference row + its group children into a calendar
    // entry. Works for both V1 and V2 — the column shapes are nearly
    // identical (V1 uses tenant_references, V2 uses tenant_references_v2).
    const buildEntry = (ref: any, groupMembers: any[], version: 'v1' | 'v2') => {
      const allTenants = [ref, ...groupMembers]
      const tenants = allTenants.map((t: any) => {
        const first = t.tenant_first_name_encrypted ? (decrypt(t.tenant_first_name_encrypted) || '') : ''
        const last = t.tenant_last_name_encrypted ? (decrypt(t.tenant_last_name_encrypted) || '') : ''
        const name = `${first} ${last}`.trim() || 'Tenant'
        return { id: t.id, name }
      })

      let propertyAddress = ''
      let propertyCity = ''
      let propertyPostcode = ''
      try {
        propertyAddress = ref.property_address_encrypted ? (decrypt(ref.property_address_encrypted) || '') : ''
        propertyCity = ref.property_city_encrypted ? (decrypt(ref.property_city_encrypted) || '') : ''
        propertyPostcode = ref.property_postcode_encrypted ? (decrypt(ref.property_postcode_encrypted) || '') : ''
      } catch (e) {}

      return {
        referenceId: ref.id,
        referenceVersion: version,
        referenceNumber: ref.reference_number || null,
        tenancyId: ref.converted_to_tenancy_id || null,
        moveInDate: ref.move_in_date,
        property: {
          address: propertyAddress,
          city: propertyCity,
          postcode: propertyPostcode,
        },
        rentAmount: ref.monthly_rent || null,
        tenants,
        groupSize: tenants.length,
        status: ref.status,
        allActionsComplete: true,
        type: 'move_in' as const,
      }
    }

    // ========================================================================
    // V2 references
    // ========================================================================
    const { data: v2Refs, error: v2Err } = await supabase
      .from('tenant_references_v2')
      .select(`
        id,
        status,
        is_guarantor,
        is_group_parent,
        parent_reference_id,
        move_in_date,
        monthly_rent,
        rent_share,
        tenant_first_name_encrypted,
        tenant_last_name_encrypted,
        property_address_encrypted,
        property_city_encrypted,
        property_postcode_encrypted,
        linked_property_id,
        reference_number,
        converted_to_tenancy_id
      `)
      .eq('company_id', companyId)
      .eq('is_guarantor', false)
      .not('move_in_date', 'is', null)
      .gte('move_in_date', startDateStr)
      .lte('move_in_date', endDateStr)
      .order('move_in_date', { ascending: true })

    if (v2Err) {
      console.error('[References] V2 calendar query error:', v2Err)
      return res.status(500).json({ error: 'Failed to fetch V2 calendar data' })
    }

    const v2 = collapseGroups(v2Refs || [])

    // Backfill V2 parents that fall outside the date window but have
    // children inside it (rare).
    for (const [parentId, children] of v2.childrenByParent.entries()) {
      if (!v2.parentById.has(parentId) && children.length > 0) {
        const { data: parent } = await supabase
          .from('tenant_references_v2')
          .select(`
            id, status, is_guarantor, is_group_parent, parent_reference_id,
            move_in_date, monthly_rent, rent_share,
            tenant_first_name_encrypted, tenant_last_name_encrypted,
            property_address_encrypted, property_city_encrypted, property_postcode_encrypted,
            linked_property_id, reference_number, converted_to_tenancy_id
          `)
          .eq('id', parentId)
          .eq('company_id', companyId)
          .maybeSingle()
        if (parent && parent.move_in_date && parent.move_in_date >= startDateStr && parent.move_in_date <= endDateStr) {
          v2.parentById.set(parent.id, parent)
        }
      }
    }

    const v2Entries = Array.from(v2.parentById.values()).map((ref: any) =>
      buildEntry(ref, v2.childrenByParent.get(ref.id) || [], 'v2')
    )

    // ========================================================================
    // V1 references — same shape, different table
    // ========================================================================
    // V1 tenant_references doesn't have a reference_number or
    // converted_to_tenancy_id column, so we select null for those.
    const { data: v1Refs, error: v1Err } = await supabase
      .from('tenant_references')
      .select(`
        id,
        status,
        is_guarantor,
        is_group_parent,
        parent_reference_id,
        move_in_date,
        monthly_rent,
        tenant_first_name_encrypted,
        tenant_last_name_encrypted,
        property_address_encrypted,
        property_city_encrypted,
        property_postcode_encrypted,
        linked_property_id,
        converted_to_tenancy_id
      `)
      .eq('company_id', companyId)
      .eq('is_guarantor', false)
      .not('move_in_date', 'is', null)
      .gte('move_in_date', startDateStr)
      .lte('move_in_date', endDateStr)
      .order('move_in_date', { ascending: true })

    if (v1Err) {
      // V1 failure is non-fatal — log and continue with V2 results so the
      // calendar still renders if the V1 schema diverges.
      console.error('[References] V1 calendar query error (non-fatal):', v1Err.message)
    }

    const v1 = collapseGroups(v1Refs || [])

    for (const [parentId, children] of v1.childrenByParent.entries()) {
      if (!v1.parentById.has(parentId) && children.length > 0) {
        const { data: parent } = await supabase
          .from('tenant_references')
          .select(`
            id, status, is_guarantor, is_group_parent, parent_reference_id,
            move_in_date, monthly_rent,
            tenant_first_name_encrypted, tenant_last_name_encrypted,
            property_address_encrypted, property_city_encrypted, property_postcode_encrypted,
            linked_property_id, converted_to_tenancy_id
          `)
          .eq('id', parentId)
          .eq('company_id', companyId)
          .maybeSingle()
        if (parent && parent.move_in_date && parent.move_in_date >= startDateStr && parent.move_in_date <= endDateStr) {
          v1.parentById.set(parent.id, parent)
        }
      }
    }

    const v1Entries = Array.from(v1.parentById.values()).map((ref: any) =>
      buildEntry(ref, v1.childrenByParent.get(ref.id) || [], 'v1')
    )

    // ========================================================================
    // Tenancies — third source for the move-in calendar.
    // ========================================================================
    // Includes any pending or active tenancy with a tenancy_start_date in
    // Pull ALL draft (pending) tenancies with a start date in range.
    // No pre-filtering against references here — dedup happens at the
    // END via surname matching. The previous approach was removing
    // tenancies whose primary_reference_id matched a V1/V2 ref, which
    // dropped 25 of 26 entries for RG Bristol because nearly every draft
    // tenancy was converted from a reference. The user wants to see
    // every upcoming move-in from ALL sources, deduped only by tenant
    // surname + date at the end.

    let tenancyEntries: any[] = []
    try {
      const { data: tenancies, error: tenErr } = await supabase
        .from('tenancies')
        .select(`
          id,
          tenancy_start_date,
          monthly_rent,
          rent_amount,
          status,
          property_id,
          primary_reference_id
        `)
        .eq('company_id', companyId)
        .eq('status', 'pending')
        .is('deleted_at', null)
        .not('tenancy_start_date', 'is', null)
        .gte('tenancy_start_date', startDateStr)
        .lte('tenancy_start_date', endDateStr)
        .order('tenancy_start_date', { ascending: true })

      if (tenErr) {
        console.error('[References] Tenancies calendar query error (non-fatal):', tenErr.message)
      }

      const tenanciesToShow = tenancies || []
      // No explicit dedup here — surname-based dedup at the end handles it

      // Need property + tenant data to build calendar entries
      const tenancyIds = tenanciesToShow.map((t: any) => t.id)
      const propertyIds = [...new Set(tenanciesToShow.map((t: any) => t.property_id).filter(Boolean))]

      const propertyMap = new Map<string, any>()
      if (propertyIds.length > 0) {
        const { data: properties } = await supabase
          .from('properties')
          .select('id, address_line1_encrypted, city_encrypted, postcode')
          .in('id', propertyIds)
        for (const p of (properties || [])) propertyMap.set(p.id, p)
      }

      const tenantMap = new Map<string, any[]>()
      if (tenancyIds.length > 0) {
        const { data: allTenants } = await supabase
          .from('tenancy_tenants')
          .select('id, tenancy_id, tenant_name_encrypted, tenant_order, is_lead_tenant')
          .in('tenancy_id', tenancyIds)
          .eq('is_active', true)
        for (const t of (allTenants || [])) {
          if (!tenantMap.has(t.tenancy_id)) tenantMap.set(t.tenancy_id, [])
          tenantMap.get(t.tenancy_id)!.push(t)
        }
      }

      tenancyEntries = tenanciesToShow.map((t: any) => {
        const prop = propertyMap.get(t.property_id)
        let propertyAddress = ''
        let propertyCity = ''
        let propertyPostcode = ''
        try {
          propertyAddress = prop?.address_line1_encrypted ? (decrypt(prop.address_line1_encrypted) || '') : ''
          propertyCity = prop?.city_encrypted ? (decrypt(prop.city_encrypted) || '') : ''
          propertyPostcode = prop?.postcode || ''
        } catch (e) {}

        const tenants = (tenantMap.get(t.id) || [])
          .sort((a: any, b: any) => (a.tenant_order || 99) - (b.tenant_order || 99))
          .map((tt: any) => {
            let name = 'Tenant'
            try {
              name = tt.tenant_name_encrypted ? (decrypt(tt.tenant_name_encrypted) || 'Tenant') : 'Tenant'
            } catch (e) {}
            return { id: tt.id, name }
          })

        return {
          referenceId: null,
          referenceVersion: undefined,
          referenceNumber: null,
          tenancyId: t.id,
          moveInDate: t.tenancy_start_date,
          property: {
            address: propertyAddress,
            city: propertyCity,
            postcode: propertyPostcode,
          },
          rentAmount: t.monthly_rent || t.rent_amount || null,
          tenants,
          groupSize: tenants.length,
          status: t.status,
          allActionsComplete: true,
          type: 'move_in' as const,
        }
      })
    } catch (e: any) {
      console.error('[References] Tenancies calendar fetch failed (non-fatal):', e?.message || e)
    }

    // ========================================================================
    // Merge V2 + V1 + tenancies, then dedupe by TENANT SURNAME + move-in
    // date. The previous approach (address + date) incorrectly collapsed
    // multi-unit properties where different tenants move in on the same
    // day at the same address (e.g. Room 1 + Room 2 at 51 Warren Road).
    //
    // Surname-based dedup: extract the lead tenant's surname (last word
    // of their name), combine with move-in date. Two entries with the
    // same surname + date are treated as duplicates (same person
    // appearing in both a reference and a tenancy). Different surnames
    // at the same address/date are preserved (different tenants).
    //
    // Priority order: V2 > V1 > tenancy (sources are already in this
    // order in the array, so a Map.set from first to last preserves
    // the highest-priority entry).
    // ========================================================================
    const entries = [...v2Entries, ...v1Entries, ...tenancyEntries]

    const extractSurname = (tenants: any[]): string => {
      if (!tenants || tenants.length === 0) return ''
      const leadName = (tenants[0]?.name || '').trim()
      if (!leadName) return ''
      const parts = leadName.split(/\s+/)
      return (parts[parts.length - 1] || '').toLowerCase()
    }

    const dedupedByKey = new Map<string, any>()
    for (const e of entries) {
      const surname = extractSurname(e.tenants)
      // Without a surname there's no reliable way to dedupe, so pass
      // through with a unique key
      const key = surname
        ? `${surname}|${e.moveInDate}`
        : `unique-${e.referenceId || e.tenancyId || Math.random()}`
      if (!dedupedByKey.has(key)) {
        dedupedByKey.set(key, e)
      }
    }

    const dedupedEntries = Array.from(dedupedByKey.values())
    dedupedEntries.sort((a, b) => (a.moveInDate < b.moveInDate ? -1 : a.moveInDate > b.moveInDate ? 1 : 0))

    res.json({
      startDate: startDateStr,
      endDate: endDateStr,
      entries: dedupedEntries,
    })
  } catch (error: any) {
    console.error('[References] Error in calendar endpoint:', error)
    res.status(500).json({ error: error.message || 'Calendar error' })
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

    // Decrypt form_data + run all queries in parallel for speed
    const [decryptedFormData, sections, guarantor, creditResult, amlResult, children, offerResult] = await Promise.all([
      Promise.resolve(decryptFormData(result.reference.form_data)),
      getSections(id),
      getGuarantor(id),
      supabase.from('creditsafe_verifications_v2').select('*').eq('reference_id', id).order('created_at', { ascending: false }).then(r => r.data),
      supabase.from('sanctions_screenings_v2').select('*').eq('reference_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle().then(r => r.data),
      result.reference.is_group_parent ? getGroupChildren(id) : Promise.resolve(null),
      result.reference.offer_id
        ? supabase.from('tenant_offers').select('unihomes_offered, unihomes_interested').eq('id', result.reference.offer_id).maybeSingle().then(r => r.data)
        : Promise.resolve(null)
    ])

    res.json({
      ...result,
      reference: {
        ...result.reference,
        tenant_first_name: decrypt(result.reference.tenant_first_name_encrypted),
        tenant_last_name: decrypt(result.reference.tenant_last_name_encrypted),
        tenant_email: decrypt(result.reference.tenant_email_encrypted),
        tenant_phone: decrypt(result.reference.tenant_phone_encrypted),
        property_address: decrypt(result.reference.property_address_encrypted),
        property_city: decrypt(result.reference.property_city_encrypted),
        property_postcode: decrypt(result.reference.property_postcode_encrypted),
        employer_ref_name: decrypt(result.reference.employer_ref_name_encrypted),
        employer_ref_email: decrypt(result.reference.employer_ref_email_encrypted),
        employer_ref_phone: decrypt(result.reference.employer_ref_phone_encrypted),
        previous_landlord_name: decrypt(result.reference.previous_landlord_name_encrypted),
        previous_landlord_email: decrypt(result.reference.previous_landlord_email_encrypted),
        previous_landlord_phone: decrypt(result.reference.previous_landlord_phone_encrypted),
        accountant_name: decrypt(result.reference.accountant_name_encrypted),
        accountant_email: decrypt(result.reference.accountant_email_encrypted),
        accountant_phone: decrypt(result.reference.accountant_phone_encrypted),
        form_data: decryptedFormData,
        offer_unihomes: offerResult?.unihomes_offered || false,
        unihomes_interested: offerResult?.unihomes_interested || false
      },
      sections,
      children,
      guarantor,
      creditCheck: Array.isArray(creditResult) ? creditResult[0] || null : creditResult,
      creditChecks: Array.isArray(creditResult) ? creditResult : (creditResult ? [creditResult] : []),
      amlCheck: amlResult
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

    // Build decision label
    const isAccepted = ['ACCEPTED', 'ACCEPTED_WITH_GUARANTOR', 'ACCEPTED_ON_CONDITION'].includes(reference.status)
    const decisionLabel = isAccepted ? 'Accepted' : reference.status === 'REJECTED' ? 'Rejected' : reference.status
    const decisionColor = isAccepted ? '#1A7A4A' : '#C0392B'
    const decisionBg = isAccepted ? '#EAF7F1' : '#FDECEA'

    // Get agent logo as base64 for email
    let logoHtml = ''
    if (companyLogoUrl) {
      logoHtml = `<img src="${companyLogoUrl}" alt="${companyName}" style="max-height:48px;max-width:180px;" />`
    } else {
      logoHtml = `<span style="font-size:18px;font-weight:600;color:#1B3464;">${companyName}</span>`
    }

    const reportUrl = reference.report_pdf_url || ''
    const reportButton = reportUrl ? `
      <div style="margin:24px 0;text-align:center;">
        <a href="${reportUrl}" style="display:inline-block;padding:14px 32px;background:#F48024;color:#fff;text-decoration:none;font-weight:600;border-radius:8px;font-size:15px;">View Full Report</a>
      </div>` : ''

    const emailHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
    <body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f3f4f6;">
      <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <div style="background:#1B3464;padding:20px 24px;border-bottom:3px solid #F48024;text-align:center;">
          ${logoHtml}
        </div>
        <div style="padding:32px 24px;">
          <p style="font-size:15px;color:#374151;margin:0 0 16px;">Dear ${landlordName},</p>
          <p style="font-size:15px;color:#374151;margin:0 0 20px;">
            The reference for <strong>${result.tenantName}</strong> has been completed. The decision is:
          </p>
          <div style="background:${decisionBg};border-radius:8px;padding:16px;text-align:center;margin:0 0 20px;">
            <span style="font-size:22px;font-weight:700;color:${decisionColor};">${decisionLabel}</span>
          </div>
          <p style="font-size:14px;color:#6b7280;margin:0 0 8px;">Please see the attached report for full details.</p>
          ${reportButton}
          <p style="font-size:13px;color:#9ca3af;margin-top:20px;">Reference: ${reference.reference_number || id}</p>
        </div>
        <div style="padding:16px 24px;text-align:center;border-top:1px solid #e5e7eb;">
          <p style="font-size:11px;color:#9ca3af;margin:0;">Sent on behalf of ${companyName} via PropertyGoose</p>
        </div>
      </div>
    </body></html>`

    await sendEmail({
      to: landlordEmail,
      subject: `Reference ${decisionLabel} - ${result.tenantName} - ${result.propertyAddress || 'Property'}`,
      html: emailHtml
    })

    res.json({
      message: 'Reference report sent to landlord',
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
      .select('name_encrypted, logo_url, phone_encrypted, email_encrypted')
      .eq('id', companyId)
      .single()

    const companyName = company?.name_encrypted ? (decrypt(company.name_encrypted) || 'PropertyGoose') : 'PropertyGoose'
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
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    if (updateError) {
      console.error('[V2 References] Failed to update token:', updateError)
      return res.status(500).json({ error: 'Failed to update reference token' })
    }

    console.log('[V2 References] Token updated for reference:', id)

    // Build form URL based on whether this is a guarantor or tenant reference
    const isGuarantor = reference.is_guarantor || false
    const formPath = isGuarantor ? 'guarantor-reference-v2' : 'submit-reference-v2'
    const formUrl = `${getV2FrontendUrl()}/${formPath}/${newToken}`

    // Get tenant name
    const tenantName = result.tenantName || 'Tenant'

    if (isGuarantor) {
      // Send guarantor-specific email
      const { sendGuarantorReferenceRequest } = await import('../../services/emailService')

      // Get the tenant name from the parent reference
      let parentTenantName = 'the tenant'
      if (reference.guarantor_for_reference_id) {
        const { data: parentRef } = await supabase
          .from('tenant_references_v2')
          .select('tenant_first_name_encrypted, tenant_last_name_encrypted')
          .eq('id', reference.guarantor_for_reference_id)
          .single()
        if (parentRef) {
          const fn = parentRef.tenant_first_name_encrypted ? decrypt(parentRef.tenant_first_name_encrypted) : ''
          const ln = parentRef.tenant_last_name_encrypted ? decrypt(parentRef.tenant_last_name_encrypted) : ''
          parentTenantName = `${fn} ${ln}`.trim() || 'the tenant'
        }
      }

      await sendGuarantorReferenceRequest(
        tenantEmail,
        tenantName,
        parentTenantName,
        result.propertyAddress || 'the property',
        companyName,
        companyPhone || '',
        companyEmail || '',
        formUrl,
        id,
        companyLogoUrl,
        reference.monthly_rent || undefined,
        reference.rent_share || reference.monthly_rent || undefined
      )
    } else {
      // Send tenant reference email
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
    }

    res.json({
      message: `${isGuarantor ? 'Guarantor' : 'Reference'} request email resent`,
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

    // Find any guarantor children — a guarantor reference is its own row in
    // tenant_references_v2 with guarantor_for_reference_id pointing at this one.
    // The FK tenant_references_v2_guarantor_for_reference_id_fkey is NOT
    // ON DELETE CASCADE on all environments, so we must manually remove the
    // child (and its dependents) before the parent, otherwise the parent
    // delete fails with a 23503 FK violation.
    const { data: guarantorChildren, error: guarantorFetchError } = await supabase
      .from('tenant_references_v2')
      .select('id')
      .eq('guarantor_for_reference_id', id)

    if (guarantorFetchError) {
      console.error('[V2 References] Error fetching guarantor children:', guarantorFetchError)
      return res.status(500).json({ error: 'Failed to check guarantor children' })
    }

    const childIds = (guarantorChildren || []).map(c => c.id)
    const allIds = [...childIds, id]

    // Null the parent's pointer to the guarantor so the other FK direction is
    // also safe (it's SET NULL on most envs but be explicit).
    if (childIds.length > 0) {
      await supabase
        .from('tenant_references_v2')
        .update({ guarantor_reference_id: null })
        .eq('id', id)
    }

    // Delete dependent rows for BOTH the parent and any guarantor children.
    const { error: sectionsError } = await supabase
      .from('reference_sections_v2')
      .delete()
      .in('reference_id', allIds)

    if (sectionsError) {
      console.error('[V2 References] Error deleting sections:', sectionsError)
    }

    const { error: refereesError } = await supabase
      .from('referees_v2')
      .delete()
      .in('reference_id', allIds)

    if (refereesError) {
      console.error('[V2 References] Error deleting referees:', refereesError)
    }

    // Delete guarantor children first so the parent's FK constraint is released.
    if (childIds.length > 0) {
      const { error: childDeleteError } = await supabase
        .from('tenant_references_v2')
        .delete()
        .in('id', childIds)

      if (childDeleteError) {
        console.error('[V2 References] Error deleting guarantor children:', childDeleteError)
        return res.status(500).json({ error: 'Failed to delete guarantor children' })
      }
      console.log(`[V2 References] Deleted ${childIds.length} guarantor child reference(s) for parent ${id}`)
    }

    // Delete the parent reference
    const { error: deleteError } = await supabase
      .from('tenant_references_v2')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('[V2 References] Error deleting reference:', deleteError)
      return res.status(500).json({ error: 'Failed to delete reference', details: deleteError.message })
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

// ============================================================================
// CREDIT CHECK & AML ENDPOINTS
// ============================================================================

/**
 * Run credit check for a V2 reference
 * Uses Creditsafe Verify API to check electoral roll, CCJs, insolvencies
 */
router.post('/:id/creditsafe/run', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    const { id } = req.params

    if (!companyId) {
      return res.status(400).json({ error: 'Company ID required' })
    }

    // Check if Creditsafe is enabled
    if (!creditsafeService.isEnabled()) {
      return res.status(400).json({ error: 'Creditsafe integration is not enabled' })
    }

    // Get the reference with decrypted data
    const result = await getReferenceDecrypted(id)
    if (!result) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    // Verify company access
    if (result.reference.company_id !== companyId) {
      return res.status(403).json({ error: 'Access denied' })
    }

    const reference = result.reference
    const formData = decryptFormData(reference.form_data)

    if (!formData) {
      return res.status(400).json({ error: 'Tenant form not yet submitted' })
    }

    // Extract required fields from form_data
    const firstName = formData.identity?.firstName || decrypt(reference.tenant_first_name_encrypted)
    const lastName = formData.identity?.lastName || decrypt(reference.tenant_last_name_encrypted)
    const dateOfBirth = formData.identity?.dateOfBirth
    const address = formData.residential?.currentAddress
      ? `${formData.residential.currentAddress.line1}, ${formData.residential.currentAddress.city}`
      : null
    const postcode = formData.residential?.currentAddress?.postcode

    if (!firstName || !lastName) {
      return res.status(400).json({ error: 'Tenant name not available' })
    }
    if (!dateOfBirth) {
      return res.status(400).json({ error: 'Date of birth not available - required for credit check' })
    }
    if (!address || !postcode) {
      return res.status(400).json({ error: 'Current address not available - required for credit check' })
    }

    // Run the credit check
    const verificationResult = await creditsafeService.verifyIndividual({
      firstName,
      lastName,
      dateOfBirth,
      address,
      postcode
    })

    // Store result in V2 table
    let verificationId: string | null = null
    try {
      const { data: insertedVerification } = await supabase.from('creditsafe_verifications_v2').insert({
        reference_id: id,
        request_data_encrypted: encrypt(JSON.stringify({ firstName, lastName, dateOfBirth, address, postcode })),
        response_data_encrypted: encrypt(JSON.stringify(verificationResult)),
        transaction_id: verificationResult.transactionId || null,
        risk_level: verificationResult.riskLevel,
        risk_score: verificationResult.riskScore,
        status: verificationResult.status,
        fraud_indicators: (verificationResult as any).fraudIndicators || null
      }).select('id').single()
      verificationId = insertedVerification?.id || null
    } catch (storeErr) {
      console.error('[V2 References] Failed to store credit result:', storeErr)
    }

    // Update the CREDIT section status
    const sections = await getSections(id)
    const creditSection = sections?.find(s => s.section_type === 'CREDIT')
    if (creditSection) {
      // Determine section status based on result
      let decision: 'PASS' | 'FAIL' | 'REFER' | null = null
      if (verificationResult.status === 'passed') {
        decision = 'PASS'
      } else if (verificationResult.status === 'failed') {
        decision = 'FAIL'
      } else if (verificationResult.status === 'refer') {
        decision = 'REFER'
      }

      await updateSectionStatus(creditSection.id, {
        status: 'READY',
        decision,
        sectionData: {
          riskLevel: verificationResult.riskLevel,
          riskScore: verificationResult.riskScore,
          verifyMatch: verificationResult.verifyMatch,
          notFound: verificationResult.notFound,
          ccjMatch: verificationResult.ccjMatch,
          insolvencyMatch: verificationResult.insolvencyMatch,
          electoralRegisterMatch: verificationResult.electoralRegisterMatch,
          ccjCount: verificationResult.countyCourtJudgments?.length || 0,
          insolvencyCount: verificationResult.insolvencies?.length || 0,
          verificationId
        }
      })
    }

    console.log(`[V2 References] Credit check completed for ${id}: ${verificationResult.status}`)

    res.json({
      success: true,
      status: verificationResult.status,
      riskLevel: verificationResult.riskLevel,
      riskScore: verificationResult.riskScore,
      verifyMatch: verificationResult.verifyMatch,
      notFound: verificationResult.notFound,
      flags: {
        ccjMatch: verificationResult.ccjMatch,
        insolvencyMatch: verificationResult.insolvencyMatch,
        electoralRegisterMatch: verificationResult.electoralRegisterMatch,
        deceasedMatch: verificationResult.deceasedRegisterMatch
      },
      ccjCount: verificationResult.countyCourtJudgments?.length || 0,
      insolvencyCount: verificationResult.insolvencies?.length || 0,
      verificationId
    })
  } catch (error: any) {
    console.error('[V2 References] Error running credit check:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Get credit check result for a V2 reference
 */
router.get('/:id/creditsafe', authenticateToken, async (req: AuthRequest, res) => {
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

    // Get the credit check result from V2 table
    const { data: result } = await supabase
      .from('creditsafe_verifications_v2')
      .select('*')
      .eq('reference_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!result) {
      return res.json({ hasResult: false, result: null })
    }

    // Parse fraud indicators if present
    let fraudIndicators: any = null
    if (result.fraud_indicators) {
      try {
        fraudIndicators = typeof result.fraud_indicators === 'string'
          ? JSON.parse(result.fraud_indicators)
          : result.fraud_indicators
      } catch (e) { /* ignore */ }
    }

    // Decrypt response data for detailed arrays
    let responseData: any = null
    if (result.response_data_encrypted) {
      try {
        const decrypted = decrypt(result.response_data_encrypted)
        responseData = decrypted ? JSON.parse(decrypted) : null
      } catch (e) { /* ignore */ }
    }

    res.json({
      hasResult: true,
      result: {
        status: result.status,
        riskLevel: result.risk_level,
        riskScore: result.risk_score,
        verifyMatch: responseData?.verifyMatch || fraudIndicators?.verifyMatch,
        electoralRegisterMatch: responseData?.electoralRegisterMatch || fraudIndicators?.electoralRollMatch,
        ccjMatch: responseData?.ccjMatch || fraudIndicators?.ccjMatch,
        insolvencyMatch: responseData?.insolvencyMatch || fraudIndicators?.insolvencyMatch,
        deceasedMatch: responseData?.deceasedRegisterMatch || fraudIndicators?.deceasedMatch,
        ccjCount: responseData?.countyCourtJudgments?.length || fraudIndicators?.ccjCount || 0,
        insolvencyCount: responseData?.insolvencies?.length || fraudIndicators?.insolvencyCount || 0,
        verifiedAt: result.created_at,
        countyCourtJudgments: responseData?.countyCourtJudgments || [],
        insolvencies: responseData?.insolvencies || []
      }
    })
  } catch (error: any) {
    console.error('[V2 References] Error getting credit check:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Run AML/sanctions check for a V2 reference
 * Screens against UK Sanctions List and Electoral Commission donations
 */
router.post('/:id/aml/run', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    const { id } = req.params

    if (!companyId) {
      return res.status(400).json({ error: 'Company ID required' })
    }

    // Check if sanctions service is enabled
    if (!sanctionsService.isEnabled()) {
      return res.status(400).json({ error: 'AML/Sanctions screening is not enabled' })
    }

    // Get the reference with decrypted data
    const result = await getReferenceDecrypted(id)
    if (!result) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    // Verify company access
    if (result.reference.company_id !== companyId) {
      return res.status(403).json({ error: 'Access denied' })
    }

    const reference = result.reference
    const formData = decryptFormData(reference.form_data)

    if (!formData) {
      return res.status(400).json({ error: 'Tenant form not yet submitted' })
    }

    // Extract required fields
    const firstName = formData.identity?.firstName || decrypt(reference.tenant_first_name_encrypted)
    const lastName = formData.identity?.lastName || decrypt(reference.tenant_last_name_encrypted)
    const dateOfBirth = formData.identity?.dateOfBirth
    const postcode = formData.residential?.currentAddress?.postcode

    if (!firstName || !lastName) {
      return res.status(400).json({ error: 'Tenant name not available' })
    }

    const fullName = `${firstName} ${lastName}`.trim()

    // Run the AML/sanctions screening
    const screeningResult = await sanctionsService.screenTenant({
      name: fullName,
      dateOfBirth: dateOfBirth || undefined,
      postcode: postcode || undefined
    })

    // Store result in V2 table
    try {
      await supabase.from('sanctions_screenings_v2').insert({
        reference_id: id,
        screening_data_encrypted: encrypt(JSON.stringify(screeningResult)),
        risk_level: screeningResult.risk_level,
        total_matches: screeningResult.total_matches || 0,
        sanctions_matches: screeningResult.sanctions_matches?.length || 0,
        donation_matches: screeningResult.donation_matches?.length || 0,
        summary: screeningResult.summary || null
      })
    } catch (storeErr) {
      console.error('[V2 References] Failed to store AML result:', storeErr)
    }

    // Update the AML section status
    const sections = await getSections(id)
    const amlSection = sections?.find(s => s.section_type === 'AML')
    if (amlSection) {
      // Determine section status based on result
      let decision: 'PASS' | 'FAIL' | 'REFER' | null = null
      if (screeningResult.risk_level === 'clear' || screeningResult.risk_level === 'low') {
        decision = 'PASS'
      } else if (screeningResult.risk_level === 'high') {
        decision = 'FAIL'
      } else if (screeningResult.risk_level === 'medium') {
        decision = 'REFER'
      }

      await updateSectionStatus(amlSection.id, {
        status: 'READY',
        decision,
        sectionData: {
          riskLevel: screeningResult.risk_level,
          totalMatches: screeningResult.total_matches,
          sanctionsMatches: screeningResult.sanctions_matches?.length || 0,
          donationMatches: screeningResult.donation_matches?.length || 0,
          summary: screeningResult.summary,
          screeningDate: screeningResult.screening_date
        }
      })
    }

    console.log(`[V2 References] AML check completed for ${id}: ${screeningResult.risk_level}`)

    res.json({
      success: true,
      riskLevel: screeningResult.risk_level,
      totalMatches: screeningResult.total_matches,
      sanctionsMatches: screeningResult.sanctions_matches?.length || 0,
      donationMatches: screeningResult.donation_matches?.length || 0,
      summary: screeningResult.summary,
      requiresManualReview: sanctionsService.requiresManualReview(screeningResult),
      shouldReject: sanctionsService.shouldReject(screeningResult)
    })
  } catch (error: any) {
    console.error('[V2 References] Error running AML check:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Get AML/sanctions check result for a V2 reference
 */
router.get('/:id/aml', authenticateToken, async (req: AuthRequest, res) => {
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

    // Get the AML screening result from V2 table
    const { data: result } = await supabase
      .from('sanctions_screenings_v2')
      .select('*')
      .eq('reference_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!result) {
      return res.json({ hasResult: false, result: null })
    }

    res.json({
      hasResult: true,
      result: {
        riskLevel: result.risk_level,
        totalMatches: result.total_matches,
        sanctionsMatches: result.sanctions_matches || 0,
        donationMatches: result.donation_matches || 0,
        summary: result.summary,
        screeningDate: result.created_at
      }
    })
  } catch (error: any) {
    console.error('[V2 References] Error getting AML check:', error)
    res.status(500).json({ error: error.message })
  }
})

// ============================================================================
// FIELD EDITING & ACTIVITY LOG
// ============================================================================

/**
 * Edit a field on a reference (agent auth - requires company ownership)
 */
router.patch('/:id/edit', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params
    const { field, value } = req.body
    const companyId = await getCompanyIdForRequest(req)

    if (!field || value === undefined) {
      return res.status(400).json({ error: 'field and value are required' })
    }

    // Verify company ownership
    const reference = await getReference(id)
    if (!reference) {
      return res.status(404).json({ error: 'Reference not found' })
    }
    if (reference.company_id !== companyId) {
      return res.status(403).json({ error: 'Not authorized to edit this reference' })
    }

    const result = await editReferenceField(
      id,
      field,
      value,
      req.user?.id || 'unknown',
      'agent'
    )

    if (!result.success) {
      return res.status(400).json({ error: result.error })
    }

    res.json({ success: true, isRefereeField: result.isRefereeField })
  } catch (error: any) {
    console.error('[V2 References] Error editing field:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Get activity log for a reference (agent auth)
 */
router.get('/:id/activity', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params
    const companyId = await getCompanyIdForRequest(req)

    // Verify company ownership
    const reference = await getReference(id)
    if (!reference) {
      return res.status(404).json({ error: 'Reference not found' })
    }
    if (reference.company_id !== companyId) {
      return res.status(403).json({ error: 'Not authorized' })
    }

    const activity = await getActivityForReference(id)
    res.json({ activity })
  } catch (error: any) {
    console.error('[V2 References] Error getting activity:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Upload document for a section (agent auth)
 */
router.post('/:id/sections/:sectionId/upload', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id, sectionId } = req.params
    const { fileData, fileName, fileType, evidenceType } = req.body
    const companyId = await getCompanyIdForRequest(req)

    // Verify company ownership
    const reference = await getReference(id)
    if (!reference) {
      return res.status(404).json({ error: 'Reference not found' })
    }
    if (reference.company_id !== companyId) {
      return res.status(403).json({ error: 'Not authorized' })
    }

    // Get section to determine section_type
    const { data: section } = await supabase
      .from('reference_sections_v2')
      .select('section_type, section_data')
      .eq('id', sectionId)
      .eq('reference_id', id)
      .single()

    if (!section) {
      return res.status(404).json({ error: 'Section not found' })
    }

    // Upload file
    const buffer = Buffer.from(fileData, 'base64')
    const timestamp = Date.now()
    const filePath = `v2-evidence/${reference.company_id}/${id}/${section.section_type.toLowerCase()}/${timestamp}-${fileName}`

    const mimeMap: Record<string, string> = { '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.heic': 'image/heic', '.heif': 'image/heif' }
    const extFromName = '.' + (fileName || '').split('.').pop()?.toLowerCase()
    const resolvedFileType = (fileType && fileType !== 'application/octet-stream' && fileType !== '') ? fileType : mimeMap[extFromName] || 'application/pdf'

    const { error: uploadError } = await supabase.storage
      .from('reference-documents')
      .upload(filePath, buffer, { contentType: resolvedFileType })

    if (uploadError) {
      return res.status(500).json({ error: 'Failed to upload file' })
    }

    const { data: urlData } = supabase.storage.from('reference-documents').getPublicUrl(filePath)

    // Create evidence record
    await supabase
      .from('evidence_v2')
      .insert({
        reference_id: id,
        section_type: section.section_type,
        evidence_type: evidenceType || 'issue_document',
        file_path: filePath,
        file_name: fileName,
        file_type: fileType,
        uploaded_by: 'agent'
      })

    // Update section issue_status if there's an open issue
    const sectionData = (section.section_data || {}) as Record<string, any>
    if (sectionData.issue_status === 'OPEN') {
      sectionData.issue_status = 'RESPONSE_PENDING_REVIEW'
      await supabase
        .from('reference_sections_v2')
        .update({ section_data: sectionData, updated_at: new Date().toISOString() })
        .eq('id', sectionId)
    }

    await logActivity({
      referenceId: id,
      sectionId,
      action: 'AGENT_UPLOAD',
      performedBy: req.user?.id || 'unknown',
      performedByType: 'agent',
      notes: `Uploaded ${fileName}`
    })

    res.json({ success: true, fileUrl: urlData?.publicUrl })
  } catch (error: any) {
    console.error('[V2 References] Error uploading:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Chase a referee (agent + staff auth)
 */
router.post('/:id/chase-referee', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params
    const { refereeType, sectionType } = req.body
    const companyId = await getCompanyIdForRequest(req)

    if (!refereeType || !sectionType) {
      return res.status(400).json({ error: 'refereeType and sectionType are required' })
    }

    const reference = await getReference(id)
    if (!reference) {
      return res.status(404).json({ error: 'Reference not found' })
    }
    if (reference.company_id !== companyId) {
      return res.status(403).json({ error: 'Not authorized' })
    }

    // Find the referee
    const { data: referee } = await supabase
      .from('referees_v2')
      .select('*')
      .eq('reference_id', id)
      .eq('referee_type', refereeType)
      .maybeSingle()

    if (!referee) {
      return res.status(404).json({ error: 'Referee not found' })
    }

    // Generate new form token for the referee
    const formToken = generateToken()
    const formTokenHash = hash(formToken)

    await supabase
      .from('referees_v2')
      .update({
        form_token_hash: formTokenHash,
        updated_at: new Date().toISOString()
      })
      .eq('id', referee.id)

    // Find or create chase item
    const { data: section } = await supabase
      .from('reference_sections_v2')
      .select('id')
      .eq('reference_id', id)
      .eq('section_type', sectionType)
      .single()

    if (section) {
      // Import chase service dynamically to avoid circular deps
      const { createChaseItem } = await import('../../services/v2/chaseServiceV2')
      const refereeName = decrypt(referee.referee_name_encrypted) || ''
      const refereeEmail = decrypt(referee.referee_email_encrypted) || ''
      const refereePhone = decrypt(referee.referee_phone_encrypted) || undefined

      await createChaseItem(id, section.id, refereeType, {
        name: refereeName,
        email: refereeEmail,
        phone: refereePhone
      })

      // Send referee email with new form link
      const frontendUrl = getV2FrontendUrl()
      const refereeTypeRoute = refereeType.toLowerCase()
      const referenceLink = `${frontendUrl}/v2/${refereeTypeRoute}-reference/${formToken}`

      // Get company details for email
      const { data: company } = await supabase
        .from('companies')
        .select('name, email, phone')
        .eq('id', reference.company_id)
        .single()

      const tenantName = `${decrypt(reference.tenant_first_name_encrypted) || ''} ${decrypt(reference.tenant_last_name_encrypted) || ''}`.trim()

      if (refereeType === 'EMPLOYER') {
        const { sendEmployerReferenceRequest } = await import('../../services/emailService')
        await sendEmployerReferenceRequest(
          refereeEmail,
          refereeName,
          tenantName,
          referenceLink,
          company?.name || '',
          company?.phone || '',
          company?.email || '',
          id
        )
      } else if (refereeType === 'LANDLORD') {
        const { sendLandlordReferenceRequest } = await import('../../services/emailService')
        await sendLandlordReferenceRequest(
          refereeEmail,
          refereeName,
          tenantName,
          referenceLink,
          company?.name || '',
          company?.phone || '',
          company?.email || '',
          id
        )
      }
    }

    await logActivity({
      referenceId: id,
      action: 'REFEREE_CHASED',
      performedBy: req.user?.id || 'unknown',
      performedByType: 'agent',
      notes: `Chased ${refereeType} referee`
    })

    res.json({ success: true })
  } catch (error: any) {
    console.error('[V2 References] Error chasing referee:', error)
    res.status(500).json({ error: error.message })
  }
})

// ============================================================================
// TENANCY CONVERSION
// ============================================================================

/**
 * Validate and preview conversion data
 */
router.get('/:id/convert/validate', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) return res.status(401).json({ error: 'Company not found' })
    const { id } = req.params

    const result = await validateV2Conversion(id, companyId)
    res.json(result)
  } catch (error: any) {
    console.error('[V2 References] Error validating conversion:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Add guarantor to an existing V2 reference
 */
router.post('/:id/add-guarantor', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) return res.status(401).json({ error: 'Company not found' })

    const { id } = req.params
    const { firstName, lastName, email, phone, relationship } = req.body

    if (!firstName || !lastName || !email || !relationship) {
      return res.status(400).json({ error: 'First name, last name, email, and relationship are required' })
    }

    // Get the tenant reference
    const { data: tenantRef, error: refError } = await supabase
      .from('tenant_references_v2')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyId)
      .single()

    if (refError || !tenantRef) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    if (tenantRef.is_guarantor) {
      return res.status(400).json({ error: 'Cannot add a guarantor to a guarantor reference' })
    }

    if (tenantRef.guarantor_reference_id) {
      return res.status(400).json({ error: 'This tenant already has a guarantor' })
    }

    // Create guarantor reference
    const formToken = generateToken()
    const formTokenHash = hash(formToken)

    const { data: guarantorRef, error: insertError } = await supabase
      .from('tenant_references_v2')
      .insert({
        company_id: companyId,
        branch_id: tenantRef.branch_id,
        created_by: req.user?.id,
        tenant_first_name_encrypted: encrypt(firstName),
        tenant_last_name_encrypted: encrypt(lastName),
        tenant_email_encrypted: encrypt(email),
        tenant_phone_encrypted: phone ? encrypt(phone) : null,
        property_address_encrypted: tenantRef.property_address_encrypted,
        property_city: tenantRef.property_city,
        property_postcode: tenantRef.property_postcode,
        monthly_rent: tenantRef.rent_share || tenantRef.monthly_rent,
        rent_share: tenantRef.rent_share || tenantRef.monthly_rent,
        move_in_date: tenantRef.move_in_date,
        is_guarantor: true,
        guarantor_for_reference_id: tenantRef.id,
        guarantor_relationship: relationship,
        form_token_hash: formTokenHash,
        status: 'SENT',
        offer_id: tenantRef.offer_id
      })
      .select()
      .single()

    if (insertError) {
      console.error('[V2 References] Error creating guarantor:', insertError)
      return res.status(500).json({ error: 'Failed to create guarantor reference' })
    }

    // Link guarantor to tenant reference
    await supabase
      .from('tenant_references_v2')
      .update({ guarantor_reference_id: guarantorRef.id })
      .eq('id', tenantRef.id)

    // Send guarantor email
    try {
      const { sendGuarantorReferenceRequest } = await import('../../services/emailService')
      const { data: company } = await supabase
        .from('companies')
        .select('name_encrypted, phone_encrypted, email_encrypted, logo_url')
        .eq('id', companyId)
        .single()

      const companyName = company?.name_encrypted ? (decrypt(company.name_encrypted) || 'PropertyGoose') : 'PropertyGoose'
      const companyPhone = company?.phone_encrypted ? (decrypt(company.phone_encrypted) || '') : ''
      const companyEmail = company?.email_encrypted ? (decrypt(company.email_encrypted) || '') : ''
      const propertyAddress = tenantRef.property_address_encrypted ? (decrypt(tenantRef.property_address_encrypted) || 'the property') : 'the property'
      const tenantName = `${decrypt(tenantRef.tenant_first_name_encrypted) || ''} ${decrypt(tenantRef.tenant_last_name_encrypted) || ''}`.trim()

      const guarantorFormUrl = `${process.env.FRONTEND_URL || 'https://app.propertygoose.co.uk'}/guarantor-reference-v2/${formToken}`

      await sendGuarantorReferenceRequest(
        email,
        firstName,
        tenantName,
        propertyAddress,
        companyName,
        companyPhone,
        companyEmail,
        guarantorFormUrl,
        guarantorRef.id,
        company?.logo_url || null,
        tenantRef.monthly_rent || undefined,
        tenantRef.rent_share || tenantRef.monthly_rent || undefined
      )
    } catch (emailErr) {
      console.error('[V2 References] Failed to send guarantor email:', emailErr)
    }

    // Deduct 0.5 credits for guarantor reference
    try {
      await deductCredits(companyId, 0.5, guarantorRef.id, `V2 guarantor reference: ${firstName} ${lastName}`, req.user?.id)
      console.log(`[V2 References] Deducted 0.5 credits for guarantor ${firstName} ${lastName}`)
    } catch (creditError: any) {
      console.error(`[V2 References] Guarantor credit deduction failed:`, creditError.message)
    }

    console.log(`[V2 References] Added guarantor ${firstName} ${lastName} for reference ${id}`)

    res.json({
      success: true,
      guarantorReference: {
        id: guarantorRef.id,
        reference_number: guarantorRef.reference_number
      }
    })
  } catch (error: any) {
    console.error('[V2 References] Error adding guarantor:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Convert V2 reference to tenancy
 */
router.post('/:id/convert', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) return res.status(401).json({ error: 'Company not found' })
    const { id } = req.params
    const {
      depositScheme,
      depositReference,
      depositAmount,
      additionalCharges,
      rentDueDay,
      notes,
      activateImmediately,
      managementType
    } = req.body

    const result = await convertV2ReferenceToTenancy(
      id,
      companyId,
      {
        depositScheme,
        depositReference,
        depositAmount,
        additionalCharges,
        rentDueDay,
        notes,
        activateImmediately,
        managementType
      },
      req.user?.id
    )

    if (!result.success) {
      return res.status(400).json({ error: result.error })
    }

    res.json({ tenancy: result.tenancy })
  } catch (error: any) {
    console.error('[V2 References] Error converting reference:', error)
    res.status(500).json({ error: error.message })
  }
})

export default router
