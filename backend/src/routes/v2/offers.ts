/**
 * V2 Offers Routes
 *
 * Endpoints for V2 tenant offers - clones V1 functionality with V2 filtering.
 * These routes only work for companies with V2 enabled.
 */

import { Router } from 'express'
import { randomBytes } from 'crypto'
import { authenticateToken, AuthRequest, getCompanyIdForRequest } from '../../middleware/auth'
import { supabase } from '../../config/supabase'
import { encrypt, decrypt } from '../../services/encryption'
import { sendTenantOfferRequest, sendLandlordOfferSummary, sendEmail, loadEmailTemplate } from '../../services/emailService'
import { shouldUseV2 } from '../../services/v2/referenceServiceV2'
import { matchOrCreateProperty } from '../../services/propertyMatchingService'
import { auditOfferSent } from '../../services/propertyAuditService'
import { getV2FrontendUrl } from '../../utils/frontendUrl'

const router = Router()
const frontendUrl = getV2FrontendUrl()

// ============================================================================
// SEND OFFER LINK
// ============================================================================

/**
 * Send offer form link via email (V2)
 */
router.post('/send-link', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    // Check V2 is enabled for this company
    const isV2Enabled = await shouldUseV2(companyId)
    if (!isV2Enabled) {
      return res.status(400).json({ error: 'V2 offers not enabled for this company' })
    }

    const {
      tenant_email,
      tenant_first_name,
      tenant_last_name,
      property_address,
      property_city,
      property_postcode,
      rent_amount,
      holding_deposit_amount,
      deposit_amount,
      move_in_date,
      offer_deposit_replacement,
      offer_unihomes,
      bills_included,
      linked_property_id,
      negotiator_id
    } = req.body

    // Validate required fields
    if (!tenant_email || !property_address) {
      return res.status(400).json({ error: 'Tenant email and property address are required' })
    }

    // Get company details for email branding
    const { data: company } = await supabase
      .from('companies')
      .select('name_encrypted, phone_encrypted, email_encrypted, logo_url')
      .eq('id', companyId)
      .single()

    const companyName = company?.name_encrypted
      ? (decrypt(company.name_encrypted) || 'PropertyGoose')
      : 'PropertyGoose'
    const companyPhone = company?.phone_encrypted
      ? (decrypt(company.phone_encrypted) || '')
      : ''
    const companyEmail = company?.email_encrypted
      ? (decrypt(company.email_encrypted) || '')
      : ''
    const companyLogoUrl = company?.logo_url || null

    // Handle property linking - use provided ID or auto-create
    let propertyIdToLink = linked_property_id
    if (!propertyIdToLink && property_address && property_postcode) {
      try {
        const matchResult = await matchOrCreateProperty(companyId, {
          line1: property_address,
          city: property_city || '',
          postcode: property_postcode
        }, {
          autoCreate: true,
          userId
        })
        if (matchResult.property_id) {
          propertyIdToLink = matchResult.property_id
        }
      } catch (propError: any) {
        console.error('[V2 Offers] Failed to match/create property:', propError)
      }
    }

    // Generate V2 offer form link
    const depositReplacementQuery = offer_deposit_replacement ? '&deposit_replacement_offered=1' : ''
    const unihomesQuery = offer_unihomes ? '&unihomes=1' : ''
    const billsIncludedQuery = bills_included ? '&bills_included=1' : ''
    const propertyAddressQuery = property_address ? `&property_address=${encodeURIComponent(property_address)}` : ''
    const propertyCityQuery = property_city ? `&property_city=${encodeURIComponent(property_city)}` : ''
    const propertyPostcodeQuery = property_postcode ? `&property_postcode=${encodeURIComponent(property_postcode)}` : ''
    const rentAmountQuery = rent_amount ? `&rent_amount=${encodeURIComponent(rent_amount)}` : ''
    const holdingDepositQuery = holding_deposit_amount ? `&holding_deposit_amount=${encodeURIComponent(holding_deposit_amount)}` : ''
    const depositAmountQuery = deposit_amount ? `&deposit_amount=${encodeURIComponent(deposit_amount)}` : ''
    const moveInDateQuery = move_in_date ? `&move_in_date=${encodeURIComponent(move_in_date)}` : ''
    const propertyIdQuery = propertyIdToLink ? `&linked_property_id=${encodeURIComponent(propertyIdToLink)}` : ''
    // Add v2 flag to the URL so tenant form knows it's V2
    const offerLink = `${frontendUrl}/tenant-offer?company_id=${companyId}&v2=1${depositReplacementQuery}${unihomesQuery}${billsIncludedQuery}${propertyAddressQuery}${propertyCityQuery}${propertyPostcodeQuery}${rentAmountQuery}${holdingDepositQuery}${depositAmountQuery}${moveInDateQuery}${propertyIdQuery}`

    // Send email to tenant
    try {
      await sendTenantOfferRequest(
        tenant_email,
        offerLink,
        companyName,
        property_address,
        companyPhone || undefined,
        companyEmail || undefined,
        companyLogoUrl
      )
      console.log('[V2 Offers] Offer email sent to:', tenant_email)
    } catch (emailError: any) {
      console.error('[V2 Offers] Failed to send email:', emailError)
    }

    // Store record with V2 flag
    const formRef = 'OF-' + Math.random().toString(36).substring(2, 10).toUpperCase()
    try {
      const { data: insertedForm, error: insertError } = await supabase
        .from('sent_offer_forms')
        .insert({
          company_id: companyId,
          sent_by: userId,
          tenant_email: tenant_email,
          form_ref: formRef,
          property_address_encrypted: encrypt(property_address),
          property_city_encrypted: property_city ? encrypt(property_city) : null,
          property_postcode_encrypted: property_postcode ? encrypt(property_postcode) : null,
          rent_amount: rent_amount || null,
          offer_deposit_replacement: !!offer_deposit_replacement,
          linked_property_id: propertyIdToLink || null,
          negotiator_id: negotiator_id || null,
          status: 'sent'
        })
        .select('id, status')
        .single()
      if (insertError) {
        console.error('[V2 Offers] Failed to store sent form:', insertError.message, insertError.details)
      } else {
        console.log('[V2 Offers] Stored sent form:', insertedForm)
      }
    } catch (dbError: any) {
      console.error('[V2 Offers] Exception storing sent form:', dbError)
    }

    // Send negotiator notification email if deal owner assigned
    if (negotiator_id) {
      try {
        const { data: negotiator } = await supabase
          .from('negotiators')
          .select('name, email')
          .eq('id', negotiator_id)
          .single()

        if (negotiator && negotiator.email) {
          // Get company's offer notification email to avoid duplicates
          const { data: companySettings } = await supabase
            .from('companies')
            .select('offer_notification_email')
            .eq('id', companyId)
            .single()

          const notificationEmail = companySettings?.offer_notification_email || companyEmail
          if (negotiator.email.toLowerCase() !== notificationEmail?.toLowerCase()) {
            const html = loadEmailTemplate('negotiator-offer-notification', {
              NegotiatorName: negotiator.name,
              TenantEmail: tenant_email,
              PropertyAddress: property_address,
              RentAmount: rent_amount ? `£${Number(rent_amount).toLocaleString()}` : 'TBC',
              CompanyName: companyName,
              AgentLogoUrl: companyLogoUrl || 'https://www.propertygoose.co.uk/logo.png'
            })

            await sendEmail({
              to: negotiator.email,
              subject: `New Offer Sent — ${property_address}`,
              html
            })
            console.log('[V2 Offers] Negotiator notification sent to:', negotiator.email)
          }
        }
      } catch (negError: any) {
        console.error('[V2 Offers] Failed to send negotiator notification:', negError)
      }
    }

    // Log property audit
    if (propertyIdToLink) {
      try {
        await auditOfferSent(propertyIdToLink, companyId, userId, tenant_email)
      } catch (auditError: any) {
        console.error('[V2 Offers] Audit log failed:', auditError)
      }
    }

    res.status(200).json({
      success: true,
      message: 'V2 offer form link sent successfully',
      email: tenant_email,
      deposit_replacement_offered: !!offer_deposit_replacement,
      unihomes_offered: !!offer_unihomes
    })
  } catch (error: any) {
    console.error('[V2 Offers] Error sending offer link:', error)
    res.status(500).json({ error: error.message })
  }
})

// ============================================================================
// RESEND OFFER EMAIL
// ============================================================================

/**
 * Resend offer form email (V2) - does NOT create a duplicate record
 */
router.post('/resend/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const { id } = req.params

    // Get the existing sent offer form
    const { data: sentForm, error: fetchError } = await supabase
      .from('sent_offer_forms')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyId)
      .single()

    if (fetchError || !sentForm) {
      return res.status(404).json({ error: 'Sent offer not found' })
    }

    // Get company details for email branding
    const { data: company } = await supabase
      .from('companies')
      .select('name_encrypted, phone_encrypted, email_encrypted, logo_url')
      .eq('id', companyId)
      .single()

    const companyName = company?.name_encrypted
      ? (decrypt(company.name_encrypted) || 'PropertyGoose')
      : 'PropertyGoose'
    const companyPhone = company?.phone_encrypted
      ? (decrypt(company.phone_encrypted) || '')
      : ''
    const companyEmail = company?.email_encrypted
      ? (decrypt(company.email_encrypted) || '')
      : ''
    const companyLogoUrl = company?.logo_url || null

    // Decrypt stored data
    const propertyAddress = sentForm.property_address_encrypted
      ? decrypt(sentForm.property_address_encrypted)
      : ''
    const propertyCity = sentForm.property_city_encrypted
      ? decrypt(sentForm.property_city_encrypted)
      : ''
    const propertyPostcode = sentForm.property_postcode_encrypted
      ? decrypt(sentForm.property_postcode_encrypted)
      : ''

    // Generate V2 offer form link
    const depositReplacementQuery = sentForm.offer_deposit_replacement ? '&deposit_replacement_offered=1' : ''
    const unihomesQuery = sentForm.offer_unihomes ? '&unihomes=1' : ''
    const billsIncludedQuery = sentForm.bills_included ? '&bills_included=1' : ''
    const propertyAddressQuery = propertyAddress ? `&property_address=${encodeURIComponent(propertyAddress)}` : ''
    const propertyCityQuery = propertyCity ? `&property_city=${encodeURIComponent(propertyCity)}` : ''
    const propertyPostcodeQuery = propertyPostcode ? `&property_postcode=${encodeURIComponent(propertyPostcode)}` : ''
    const rentAmountQuery = sentForm.rent_amount ? `&rent_amount=${encodeURIComponent(sentForm.rent_amount)}` : ''
    const holdingDepositQuery = sentForm.holding_deposit_amount ? `&holding_deposit_amount=${encodeURIComponent(sentForm.holding_deposit_amount)}` : ''
    const depositAmountQuery = sentForm.deposit_amount ? `&deposit_amount=${encodeURIComponent(sentForm.deposit_amount)}` : ''
    const moveInDateQuery = sentForm.move_in_date ? `&move_in_date=${encodeURIComponent(sentForm.move_in_date)}` : ''
    const propertyIdQuery = sentForm.linked_property_id ? `&linked_property_id=${encodeURIComponent(sentForm.linked_property_id)}` : ''

    const offerLink = `${frontendUrl}/tenant-offer?company_id=${companyId}&v2=1${depositReplacementQuery}${unihomesQuery}${billsIncludedQuery}${propertyAddressQuery}${propertyCityQuery}${propertyPostcodeQuery}${rentAmountQuery}${holdingDepositQuery}${depositAmountQuery}${moveInDateQuery}${propertyIdQuery}`

    // Send email to tenant (email only, no new record)
    await sendTenantOfferRequest(
      sentForm.tenant_email,
      offerLink,
      companyName,
      propertyAddress || 'Property',
      companyPhone || undefined,
      companyEmail || undefined,
      companyLogoUrl
    )

    // Update sent_at timestamp
    await supabase
      .from('sent_offer_forms')
      .update({ sent_at: new Date().toISOString() })
      .eq('id', id)

    res.status(200).json({
      success: true,
      message: 'Offer email resent successfully',
      email: sentForm.tenant_email
    })
  } catch (error: any) {
    console.error('[V2 Offers] Error resending offer:', error)
    res.status(500).json({ error: error.message })
  }
})

// ============================================================================
// DELETE SENT OFFER FORM
// ============================================================================

/**
 * Delete a sent offer form (V2)
 */
router.delete('/sent/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    // Delete the sent offer form (only if it belongs to this company)
    const { error } = await supabase
      .from('sent_offer_forms')
      .delete()
      .eq('id', id)
      .eq('company_id', companyId)

    if (error) {
      console.error('[V2 Offers] Error deleting sent offer form:', error)
      return res.status(400).json({ error: error.message })
    }

    res.json({ success: true, message: 'Sent offer form deleted successfully' })
  } catch (error: any) {
    console.error('[V2 Offers] Error deleting sent offer form:', error)
    res.status(500).json({ error: error.message })
  }
})

// ============================================================================
// DELETE RECEIVED OFFER
// ============================================================================

/**
 * Delete a received offer (V2)
 */
router.delete('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    // First delete related tenant_offer_tenants
    const { error: tenantsError } = await supabase
      .from('tenant_offer_tenants')
      .delete()
      .eq('tenant_offer_id', id)

    if (tenantsError) {
      console.error('[V2 Offers] Error deleting offer tenants:', tenantsError)
    }

    // Then delete the offer itself (only if it belongs to this company and is V2)
    const { error } = await supabase
      .from('tenant_offers')
      .delete()
      .eq('id', id)
      .eq('company_id', companyId)
      .eq('is_v2', true)

    if (error) {
      console.error('[V2 Offers] Error deleting offer:', error)
      return res.status(400).json({ error: error.message })
    }

    res.json({ success: true, message: 'Offer deleted successfully' })
  } catch (error: any) {
    console.error('[V2 Offers] Error deleting offer:', error)
    res.status(500).json({ error: error.message })
  }
})

// ============================================================================
// GET SENT OFFERS
// ============================================================================

/**
 * Get sent offer forms (V2 only)
 */
router.get('/sent', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    // Get sent offer forms
    const { data: sentForms, error } = await supabase
      .from('sent_offer_forms')
      .select('*')
      .eq('company_id', companyId)
      .or('status.eq.sent,status.is.null')
      .order('sent_at', { ascending: false })

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    // Batch-fetch negotiator names for this company
    const negotiatorIds = [...new Set((sentForms || []).map(f => f.negotiator_id).filter(Boolean))]
    const negotiatorMap: Record<string, string> = {}
    if (negotiatorIds.length > 0) {
      const { data: negs } = await supabase
        .from('negotiators')
        .select('id, name')
        .in('id', negotiatorIds)
      if (negs) {
        for (const n of negs) negotiatorMap[n.id] = n.name
      }
    }

    // Decrypt sent form data
    const decryptedSentForms = sentForms?.map(form => ({
      id: form.id,
      tenant_email: form.tenant_email,
      property_address: form.property_address_encrypted ? decrypt(form.property_address_encrypted) : '',
      property_city: form.property_city_encrypted ? decrypt(form.property_city_encrypted) : '',
      property_postcode: form.property_postcode_encrypted ? decrypt(form.property_postcode_encrypted) : '',
      rent_amount: form.rent_amount,
      offer_deposit_replacement: form.offer_deposit_replacement,
      linked_property_id: form.linked_property_id,
      negotiator_id: form.negotiator_id || null,
      negotiator_name: form.negotiator_id ? (negotiatorMap[form.negotiator_id] || null) : null,
      sent_at: form.sent_at,
      created_at: form.created_at
    })) || []

    res.json({ sentForms: decryptedSentForms })
  } catch (error: any) {
    console.error('[V2 Offers] Error fetching sent forms:', error)
    res.status(500).json({ error: error.message })
  }
})

// ============================================================================
// LANDLORD DECISION ENDPOINTS (PUBLIC - no auth required)
// These MUST be defined before /:id to avoid route conflicts
// ============================================================================

/**
 * Get offer(s) by landlord decision token (PUBLIC)
 * Supports both single-offer tokens and group tokens (multiple offers)
 */
router.get('/landlord-decision/:token', async (req, res) => {
  try {
    const { token } = req.params

    if (!token) {
      return res.status(400).json({ error: 'Token is required' })
    }

    // Try single-offer token first, then group token
    let offers: any[] = []

    const offerSelect = `
        id,
        property_address_encrypted,
        property_city_encrypted,
        property_postcode_encrypted,
        offered_rent_amount,
        proposed_move_in_date,
        proposed_tenancy_length_months,
        deposit_amount,
        deposit_replacement_requested,
        bills_included,
        special_conditions_encrypted,
        status,
        landlord_decision,
        landlord_decision_at,
        landlord_decision_reason,
        landlord_decision_token,
        company_id,
        tenant_offer_tenants (
          id,
          tenant_order,
          name_encrypted,
          annual_income_encrypted,
          job_title_encrypted,
          rent_share
        )
    `

    // Try single-offer token first (use maybeSingle to avoid error on no match)
    const { data: singleOffer, error: singleError } = await supabase
      .from('tenant_offers')
      .select(offerSelect)
      .eq('landlord_decision_token', token)
      .maybeSingle()

    console.log(`[V2 Offers] Landlord decision lookup - single token match: ${singleOffer ? 'YES' : 'NO'}${singleError ? ', error: ' + singleError.message : ''}`)

    if (singleOffer) {
      offers = [singleOffer]
    } else {
      // Try group token
      const { data: groupOffers, error: groupError } = await supabase
        .from('tenant_offers')
        .select(offerSelect)
        .eq('landlord_group_token', token)
        .order('created_at', { ascending: true })

      console.log(`[V2 Offers] Landlord decision lookup - group token match: ${groupOffers?.length || 0} offers${groupError ? ', error: ' + groupError.message : ''}`)

      if (groupOffers && groupOffers.length > 0) {
        offers = groupOffers
      }
    }

    if (offers.length === 0) {
      return res.status(404).json({ error: 'Offer not found or link expired' })
    }

    // Check if ALL have been decided already
    const allDecided = offers.every(o => o.landlord_decision)
    if (allDecided) {
      return res.json({
        alreadyDecided: true,
        decisions: offers.map(o => ({
          offerId: o.id,
          decision: o.landlord_decision,
          decidedAt: o.landlord_decision_at
        }))
      })
    }

    // Get company name
    const { data: company } = await supabase
      .from('companies')
      .select('name_encrypted')
      .eq('id', offers[0].company_id)
      .single()

    const companyName = company?.name_encrypted
      ? decrypt(company.name_encrypted)
      : 'PropertyGoose'

    // Build offer data with full details
    const offerDataList = offers.map(offer => {
      const tenants = (offer.tenant_offer_tenants || [])
        .sort((a: any, b: any) => a.tenant_order - b.tenant_order)
        .map((tenant: any) => {
          const fullName = tenant.name_encrypted ? decrypt(tenant.name_encrypted) : 'Tenant'
          const firstName = fullName?.split(' ')[0] || 'Tenant'
          const annualIncomeStr = tenant.annual_income_encrypted
            ? decrypt(tenant.annual_income_encrypted)
            : null
          const annualIncome = annualIncomeStr ? parseFloat(annualIncomeStr) : undefined
          const jobTitle = tenant.job_title_encrypted
            ? decrypt(tenant.job_title_encrypted)
            : undefined

          return {
            firstName,
            jobTitle: jobTitle || undefined,
            annualIncome: annualIncome || undefined,
            rentShare: tenant.rent_share || undefined
          }
        })

      return {
        id: offer.id,
        token: offer.landlord_decision_token || null,
        propertyAddress: offer.property_address_encrypted ? decrypt(offer.property_address_encrypted) : '',
        propertyCity: offer.property_city_encrypted ? decrypt(offer.property_city_encrypted) : '',
        propertyPostcode: offer.property_postcode_encrypted ? decrypt(offer.property_postcode_encrypted) : '',
        monthlyRent: offer.offered_rent_amount || 0,
        moveInDate: offer.proposed_move_in_date || null,
        tenancyLengthMonths: offer.proposed_tenancy_length_months || null,
        depositAmount: offer.deposit_amount || null,
        depositReplacementRequested: offer.deposit_replacement_requested || false,
        unihomesInterested: offer.unihomes_interested || false,
        billsIncluded: offer.bills_included || false,
        specialConditions: offer.special_conditions_encrypted ? decrypt(offer.special_conditions_encrypted) : null,
        landlordDecision: offer.landlord_decision || null,
        landlordDecisionAt: offer.landlord_decision_at || null,
        landlordDecisionReason: offer.landlord_decision_reason || null,
        tenants
      }
    })

    // For single offer, return backwards-compatible shape
    if (offers.length === 1) {
      res.json({
        alreadyDecided: false,
        multiOffer: false,
        offer: offerDataList[0],
        companyName
      })
    } else {
      res.json({
        alreadyDecided: false,
        multiOffer: true,
        offers: offerDataList,
        companyName
      })
    }
  } catch (error: any) {
    console.error('[V2 Offers] Error getting landlord decision offer:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Submit landlord decision for a single offer (PUBLIC)
 */
router.post('/landlord-decision/:token', async (req, res) => {
  try {
    const { token } = req.params
    const { decision, reason, offerId } = req.body

    if (!token) {
      return res.status(400).json({ error: 'Token is required' })
    }

    if (!decision || !['approved', 'declined'].includes(decision)) {
      return res.status(400).json({ error: 'Decision must be "approved" or "declined"' })
    }

    if (decision === 'declined' && !reason) {
      return res.status(400).json({ error: 'Reason is required when declining' })
    }

    // Find the offer - either by individual token or by offerId + group token
    let offer: any = null

    if (offerId) {
      // Multi-offer: verify the offerId belongs to this group token
      const { data } = await supabase
        .from('tenant_offers')
        .select('id, landlord_decision, company_id, property_address_encrypted, created_by')
        .eq('id', offerId)
        .eq('landlord_group_token', token)
        .single()
      offer = data

      // Also try individual token match
      if (!offer) {
        const { data: singleData } = await supabase
          .from('tenant_offers')
          .select('id, landlord_decision, company_id, property_address_encrypted, created_by')
          .eq('id', offerId)
          .eq('landlord_decision_token', token)
          .single()
        offer = singleData
      }
    } else {
      // Single-offer: use the token directly
      const { data } = await supabase
        .from('tenant_offers')
        .select('id, landlord_decision, company_id, property_address_encrypted, created_by')
        .eq('landlord_decision_token', token)
        .single()
      offer = data
    }

    if (!offer) {
      return res.status(404).json({ error: 'Offer not found or link expired' })
    }

    if (offer.landlord_decision) {
      return res.status(400).json({ error: 'Decision has already been submitted for this offer' })
    }

    // Update the offer with landlord decision
    const { error: updateError } = await supabase
      .from('tenant_offers')
      .update({
        landlord_decision: decision,
        landlord_decision_reason: decision === 'declined' ? reason : null,
        landlord_decision_at: new Date().toISOString()
      })
      .eq('id', offer.id)

    if (updateError) {
      console.error('[V2 Offers] Error updating landlord decision:', updateError)
      return res.status(500).json({ error: 'Failed to save decision' })
    }

    // Notify the agent/user who created the offer
    try {
      const propertyAddress = offer.property_address_encrypted
        ? (decrypt(offer.property_address_encrypted) || 'Property')
        : 'Property'

      const { data: company } = await supabase
        .from('companies')
        .select('name_encrypted, logo_url')
        .eq('id', offer.company_id)
        .single()

      const companyName = company?.name_encrypted
        ? (decrypt(company.name_encrypted) || 'PropertyGoose')
        : 'PropertyGoose'
      const agentLogoUrl = company?.logo_url || 'https://app.propertygoose.co.uk/PropertyGooseLogo.png'

      // Get agent email - try company email first, then fall back to auth user who created the offer
      let agentEmail: string | null = null

      // Use company email (most reliable - this is where agents want notifications)
      const { data: companyForEmail } = await supabase
        .from('companies')
        .select('email_encrypted')
        .eq('id', offer.company_id)
        .single()

      if (companyForEmail?.email_encrypted) {
        agentEmail = decrypt(companyForEmail.email_encrypted)
      }

      // Fallback: get email from the auth user who created the offer
      if (!agentEmail && offer.created_by) {
        const { data: { user } } = await supabase.auth.admin.getUserById(offer.created_by)
        if (user?.email) {
          agentEmail = user.email
        }
      }

      if (agentEmail) {
        const decisionLabel = decision === 'approved' ? 'Approved' : 'Declined'
        const decisionColor = decision === 'approved' ? '#16a34a' : '#dc2626'
        const decisionBg = decision === 'approved' ? '#f0fdf4' : '#fef2f2'
        const decisionBorder = decision === 'approved' ? '#bbf7d0' : '#fecaca'
        const decisionIcon = decision === 'approved' ? '✓' : '✗'
        const reasonHtml = decision === 'declined' && reason
          ? `<div style="margin: 16px 0 0; padding: 12px; background-color: #fef2f2; border-radius: 6px; border: 1px solid #fecaca;">
              <p style="margin: 0; font-size: 13px; font-weight: 600; color: #991b1b;">Reason for declining:</p>
              <p style="margin: 4px 0 0; font-size: 14px; color: #dc2626; font-style: italic;">"${reason}"</p>
            </div>`
          : ''

        const html = loadEmailTemplate('landlord-decision-notification', {
          AgentLogoUrl: agentLogoUrl,
          CompanyName: companyName,
          PropertyAddress: propertyAddress,
          DecisionLabel: decisionLabel,
          DecisionColor: decisionColor,
          DecisionBg: decisionBg,
          DecisionBorder: decisionBorder,
          DecisionIcon: decisionIcon,
          ReasonHtml: reasonHtml
        })

        await sendEmail({
          to: agentEmail,
          subject: `Landlord ${decisionLabel} Offer - ${propertyAddress}`,
          html
        })

        console.log(`[V2 Offers] Landlord decision notification sent to agent ${agentEmail}`)
      }
    } catch (notifyError) {
      console.error('[V2 Offers] Error notifying agent of landlord decision:', notifyError)
    }

    res.json({
      success: true,
      message: decision === 'approved'
        ? 'Thank you! Your approval has been recorded.'
        : 'Thank you! Your response has been recorded.'
    })
  } catch (error: any) {
    console.error('[V2 Offers] Error submitting landlord decision:', error)
    res.status(500).json({ error: error.message })
  }
})

// ============================================================================
// GET OFFERS
// ============================================================================

/**
 * Get all V2 offers for company
 */
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    // Get V2 offers with tenants
    const { data: offers, error } = await supabase
      .from('tenant_offers')
      .select(`
        *,
        tenant_offer_tenants (
          id,
          tenant_order,
          name_encrypted,
          address_encrypted,
          phone_encrypted,
          email_encrypted,
          annual_income_encrypted,
          job_title_encrypted,
          no_ccj_bankruptcy_iva,
          signature_encrypted,
          signature_name_encrypted,
          signed_at,
          rent_share,
          rent_share_percentage
        )
      `)
      .eq('company_id', companyId)
      .eq('is_v2', true)
      .order('created_at', { ascending: false })

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    // Batch-fetch negotiator names
    const negIds = [...new Set((offers || []).map(o => o.negotiator_id).filter(Boolean))]
    const negMap: Record<string, string> = {}
    if (negIds.length > 0) {
      const { data: negs } = await supabase
        .from('negotiators')
        .select('id, name')
        .in('id', negIds)
      if (negs) {
        for (const n of negs) negMap[n.id] = n.name
      }
    }

    // Decrypt offer data
    const decryptedOffers = offers?.map(offer => {
      const tenants = (offer.tenant_offer_tenants || []).map((tenant: any) => ({
        id: tenant.id,
        tenant_order: tenant.tenant_order,
        name: tenant.name_encrypted ? decrypt(tenant.name_encrypted) : '',
        address: tenant.address_encrypted ? decrypt(tenant.address_encrypted) : '',
        phone: tenant.phone_encrypted ? decrypt(tenant.phone_encrypted) : '',
        email: tenant.email_encrypted ? decrypt(tenant.email_encrypted) : '',
        annual_income: tenant.annual_income_encrypted ? decrypt(tenant.annual_income_encrypted) : '',
        job_title: tenant.job_title_encrypted ? decrypt(tenant.job_title_encrypted) : '',
        no_ccj_bankruptcy_iva: tenant.no_ccj_bankruptcy_iva,
        signature: tenant.signature_encrypted ? decrypt(tenant.signature_encrypted) : '',
        signature_name: tenant.signature_name_encrypted ? decrypt(tenant.signature_name_encrypted) : '',
        signed_at: tenant.signed_at,
        rent_share: tenant.rent_share,
        rent_share_percentage: tenant.rent_share_percentage
      }))

      return {
        ...offer,
        property_address: offer.property_address_encrypted ? decrypt(offer.property_address_encrypted) : '',
        property_city: offer.property_city_encrypted ? decrypt(offer.property_city_encrypted) : '',
        property_postcode: offer.property_postcode_encrypted ? decrypt(offer.property_postcode_encrypted) : '',
        special_conditions: offer.special_conditions_encrypted ? decrypt(offer.special_conditions_encrypted) : '',
        declined_reason: offer.declined_reason_encrypted ? decrypt(offer.declined_reason_encrypted) : '',
        negotiator_name: offer.negotiator_id ? (negMap[offer.negotiator_id] || null) : null,
        tenants: tenants.sort((a: any, b: any) => a.tenant_order - b.tenant_order)
      }
    }) || []

    res.json({ offers: decryptedOffers })
  } catch (error: any) {
    console.error('[V2 Offers] Error fetching offers:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Get single V2 offer by ID
 */
router.get('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    const { id } = req.params

    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const { data: offer, error } = await supabase
      .from('tenant_offers')
      .select(`
        *,
        tenant_offer_tenants (
          id,
          tenant_order,
          name_encrypted,
          address_encrypted,
          phone_encrypted,
          email_encrypted,
          annual_income_encrypted,
          job_title_encrypted,
          no_ccj_bankruptcy_iva,
          signature_encrypted,
          signature_name_encrypted,
          signed_at,
          rent_share,
          rent_share_percentage
        )
      `)
      .eq('id', id)
      .eq('company_id', companyId)
      .single()

    if (error || !offer) {
      return res.status(404).json({ error: 'Offer not found' })
    }

    // Decrypt
    const tenants = (offer.tenant_offer_tenants || []).map((tenant: any) => ({
      id: tenant.id,
      tenant_order: tenant.tenant_order,
      name: tenant.name_encrypted ? decrypt(tenant.name_encrypted) : '',
      address: tenant.address_encrypted ? decrypt(tenant.address_encrypted) : '',
      phone: tenant.phone_encrypted ? decrypt(tenant.phone_encrypted) : '',
      email: tenant.email_encrypted ? decrypt(tenant.email_encrypted) : '',
      annual_income: tenant.annual_income_encrypted ? decrypt(tenant.annual_income_encrypted) : '',
      no_ccj_bankruptcy_iva: tenant.no_ccj_bankruptcy_iva,
      signature: tenant.signature_encrypted ? decrypt(tenant.signature_encrypted) : '',
      signature_name: tenant.signature_name_encrypted ? decrypt(tenant.signature_name_encrypted) : '',
      signed_at: tenant.signed_at,
      rent_share: tenant.rent_share,
      rent_share_percentage: tenant.rent_share_percentage
    }))

    res.json({
      offer: {
        ...offer,
        property_address: offer.property_address_encrypted ? decrypt(offer.property_address_encrypted) : '',
        property_city: offer.property_city_encrypted ? decrypt(offer.property_city_encrypted) : '',
        property_postcode: offer.property_postcode_encrypted ? decrypt(offer.property_postcode_encrypted) : '',
        special_conditions: offer.special_conditions_encrypted ? decrypt(offer.special_conditions_encrypted) : '',
        declined_reason: offer.declined_reason_encrypted ? decrypt(offer.declined_reason_encrypted) : '',
        tenants: tenants.sort((a: any, b: any) => a.tenant_order - b.tenant_order)
      }
    })
  } catch (error: any) {
    console.error('[V2 Offers] Error fetching offer:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Send offer summary to landlord
 */
router.post('/send-to-landlord', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    const { offerIds, landlordEmail: manualLandlordEmail } = req.body

    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    if (!offerIds || !Array.isArray(offerIds) || offerIds.length === 0) {
      return res.status(400).json({ error: 'At least one offer ID is required' })
    }

    // Get all offers with tenant data
    const { data: offers, error } = await supabase
      .from('tenant_offers')
      .select(`
        *,
        tenant_offer_tenants (*)
      `)
      .in('id', offerIds)
      .eq('company_id', companyId)

    if (error || !offers || offers.length === 0) {
      return res.status(404).json({ error: 'No offers found' })
    }

    // Get property address from first offer (assuming all are same property)
    const firstOffer = offers[0]
    const propertyAddress = firstOffer.property_address_encrypted
      ? decrypt(firstOffer.property_address_encrypted)
      : ''
    const propertyPostcode = firstOffer.property_postcode_encrypted
      ? decrypt(firstOffer.property_postcode_encrypted)
      : ''

    // Get landlord email - either from linked property or manual input
    let landlordEmail = manualLandlordEmail
    let landlordName = 'Landlord'

    // First try linked_property_id, then fallback to address matching
    let propertyIdForLandlord = firstOffer.linked_property_id

    if (!propertyIdForLandlord && propertyPostcode) {
      // Try to find property by postcode match
      const { data: properties } = await supabase
        .from('properties')
        .select('id, postcode, address_line1_encrypted')
        .eq('company_id', companyId)
        .eq('postcode', propertyPostcode.toUpperCase().replace(/\s/g, ''))

      if (properties && properties.length > 0) {
        if (properties.length === 1) {
          propertyIdForLandlord = properties[0].id
        } else if (propertyAddress) {
          const matchedProperty = properties.find(p => {
            const propAddress = p.address_line1_encrypted ? decrypt(p.address_line1_encrypted) : ''
            return propAddress?.toLowerCase().includes(propertyAddress.toLowerCase()) ||
                   propertyAddress.toLowerCase().includes(propAddress?.toLowerCase() || '')
          })
          if (matchedProperty) {
            propertyIdForLandlord = matchedProperty.id
          }
        }
      }
    }

    if (!landlordEmail && propertyIdForLandlord) {
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
        .eq('property_id', propertyIdForLandlord)
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

    const companyName = company?.name_encrypted
      ? (decrypt(company.name_encrypted) || 'PropertyGoose')
      : 'PropertyGoose'
    const companyLogoUrl = company?.logo_url || null

    // Build offers data (first names only, job info, salary - NO contact details)
    const offerData = offers.map(offer => {
      const tenants = (offer.tenant_offer_tenants || [])
        .sort((a: any, b: any) => a.tenant_order - b.tenant_order)
        .map((tenant: any) => {
          const fullName = tenant.name_encrypted ? decrypt(tenant.name_encrypted) : 'Tenant'
          const firstName = fullName?.split(' ')[0] || 'Tenant'
          const annualIncomeStr = tenant.annual_income_encrypted
            ? decrypt(tenant.annual_income_encrypted)
            : null
          const annualIncome = annualIncomeStr ? parseFloat(annualIncomeStr) : undefined
          const jobTitle = tenant.job_title_encrypted
            ? decrypt(tenant.job_title_encrypted)
            : undefined

          return {
            firstName,
            jobTitle: jobTitle || undefined,
            annualIncome: annualIncome || undefined,
            rentShare: tenant.rent_share || undefined,
            isStudent: (tenant as any).is_student || false,
            hasGuarantor: (tenant as any).has_guarantor || false
          }
        })

      const monthlyRent = offer.offered_rent_amount || 0
      // Use proposed_move_in_date (tenant's proposed date) or fall back to move_in_date
      const moveInDate = offer.proposed_move_in_date || undefined

      return {
        monthlyRent,
        moveInDate,
        tenancyLengthMonths: offer.proposed_tenancy_length_months || null,
        depositAmount: offer.deposit_amount || null,
        depositReplacementRequested: offer.deposit_replacement_requested || false,
        unihomesInterested: offer.unihomes_interested || false,
        billsIncluded: offer.bills_included || false,
        specialConditions: offer.special_conditions_encrypted ? decrypt(offer.special_conditions_encrypted) : null,
        status: offer.status || 'PENDING',
        tenants
      }
    })

    // Generate decision tokens for landlord
    let decisionToken: string | null = null
    if (offers.length === 1) {
      // Single offer: use individual token
      decisionToken = randomBytes(32).toString('hex')
      const { error: tokenError } = await supabase
        .from('tenant_offers')
        .update({
          landlord_decision_token: decisionToken,
          landlord_sent_at: new Date().toISOString()
        })
        .eq('id', firstOffer.id)
      if (tokenError) {
        console.error('[V2 Offers] Error saving decision token:', tokenError)
      } else {
        console.log(`[V2 Offers] Decision token saved for offer ${firstOffer.id}: ${decisionToken.substring(0, 8)}...`)
      }
    } else {
      // Multiple offers: use a shared group token, plus individual tokens for each
      const groupToken = randomBytes(32).toString('hex')
      decisionToken = groupToken
      for (const offer of offers) {
        const individualToken = randomBytes(32).toString('hex')
        const { error: tokenError } = await supabase
          .from('tenant_offers')
          .update({
            landlord_decision_token: individualToken,
            landlord_group_token: groupToken,
            landlord_sent_at: new Date().toISOString()
          })
          .eq('id', offer.id)
        if (tokenError) {
          console.error(`[V2 Offers] Error saving group token for offer ${offer.id}:`, tokenError)
        }
      }
      console.log(`[V2 Offers] Group token saved for ${offers.length} offers: ${groupToken.substring(0, 8)}...`)
    }

    // Send email
    console.log(`[V2 Offers] Sending email with decisionToken: ${decisionToken}`)
    await sendLandlordOfferSummary(
      landlordEmail,
      landlordName,
      propertyAddress || 'Property',
      offerData,
      companyName,
      companyLogoUrl,
      decisionToken
    )

    res.json({
      message: `Offer summary sent to landlord`,
      sentTo: landlordEmail,
      offerCount: offers.length
    })
  } catch (error: any) {
    console.error('[V2 Offers] Error sending to landlord:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Get landlord email for offers (from linked property)
 */
router.post('/landlord-email', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    const { offerIds } = req.body

    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    if (!offerIds || !Array.isArray(offerIds) || offerIds.length === 0) {
      return res.status(400).json({ error: 'At least one offer ID is required' })
    }

    // Get first offer to check for linked property
    const { data: offer, error: offerError } = await supabase
      .from('tenant_offers')
      .select('id, linked_property_id, property_address_encrypted, property_postcode_encrypted')
      .eq('id', offerIds[0])
      .eq('company_id', companyId)
      .single()

    let propertyId = offer?.linked_property_id

    // If no linked_property_id, try to find property by address match
    if (!propertyId && offer) {
      const offerPostcode = offer.property_postcode_encrypted ? decrypt(offer.property_postcode_encrypted) : null
      const offerAddress = offer.property_address_encrypted ? decrypt(offer.property_address_encrypted) : null

      if (offerPostcode) {
        // Find property by postcode
        const { data: properties } = await supabase
          .from('properties')
          .select('id, postcode, address_line1_encrypted')
          .eq('company_id', companyId)
          .eq('postcode', offerPostcode.toUpperCase().replace(/\s/g, ''))

        if (properties && properties.length > 0) {
          // If multiple properties with same postcode, try to match by address
          if (properties.length === 1) {
            propertyId = properties[0].id
          } else if (offerAddress) {
            // Try to match by address line 1
            const matchedProperty = properties.find(p => {
              const propAddress = p.address_line1_encrypted ? decrypt(p.address_line1_encrypted) : ''
              return propAddress?.toLowerCase().includes(offerAddress.toLowerCase()) ||
                     offerAddress.toLowerCase().includes(propAddress?.toLowerCase() || '')
            })
            if (matchedProperty) {
              propertyId = matchedProperty.id
            }
          }
        }
      }
    }

    if (!propertyId) {
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
      .eq('property_id', propertyId)
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
    console.error('[V2 Offers] Error getting landlord email:', error)
    res.status(500).json({ error: error.message })
  }
})

export default router
