/**
 * V2 Chase Routes (Staff)
 *
 * Endpoints for managing chase queue items.
 * Handles email/SMS chase, call logging, and verbal reference capture.
 */

import { Router } from 'express'
import { authenticateStaff, StaffAuthRequest } from '../../middleware/staffAuth'
import { decrypt, generateToken, hash } from '../../services/encryption'
import { supabase } from '../../config/supabase'
import {
  getChaseQueue,
  getChaseItemDecrypted,
  getChaseItem,
  recordChaseAction,
  markChaseUnable,
  completeChaseCycle
} from '../../services/v2/chaseServiceV2'
import {
  recordVerbalReference,
  getFormTemplate,
  validateEmployerResponses,
  validateLandlordResponses
} from '../../services/v2/verbalReferenceService'
import { V2RefereeType, RecordVerbalReferenceInput } from '../../services/v2/types'
import {
  sendEmployerReferenceRequest,
  sendLandlordReferenceRequest,
  sendAgentReferenceRequest,
  sendAccountantReferenceRequest,
  sendTenantReferenceRequest
} from '../../services/emailService'
import {
  sendEmployerReferenceRequestSMS,
  sendLandlordReferenceRequestSMS,
  sendAgentReferenceRequestSMS,
  sendAccountantReferenceRequestSMS
} from '../../services/smsService'
import { getV2FrontendUrl } from '../../utils/frontendUrl'

const router = Router()
const frontendUrl = getV2FrontendUrl()

// ============================================================================
// CHASE QUEUE
// ============================================================================

/**
 * Get chase queue items (main endpoint)
 */
router.get('/', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    const { limit } = req.query

    const items = await getChaseQueue(limit ? parseInt(limit as string) : 50)

    // Decrypt referee and reference details
    const enrichedItems = items.map((item: any) => ({
      ...item,
      referee_name: decrypt(item.referee_name_encrypted),
      referee_email: decrypt(item.referee_email_encrypted),
      referee_phone: decrypt(item.referee_phone_encrypted),
      reference: item.reference ? {
        ...item.reference,
        tenant_first_name: decrypt(item.reference.tenant_first_name_encrypted),
        tenant_last_name: decrypt(item.reference.tenant_last_name_encrypted),
        property_address: decrypt(item.reference.property_address_encrypted)
      } : null
    }))

    res.json({ items: enrichedItems })
  } catch (error: any) {
    console.error('[V2 Chase] Error getting chase queue:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Get chase queue items (alternative /queue endpoint for frontend compatibility)
 */
router.get('/queue', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    const { limit } = req.query

    const items = await getChaseQueue(limit ? parseInt(limit as string) : 50)

    // Get company names
    const companyIds = [...new Set(items.map((i: any) => i.reference?.company_id).filter(Boolean))]
    const { data: companies } = companyIds.length > 0 ? await supabase
      .from('companies')
      .select('*')
      .in('id', companyIds) : { data: [] }

    const companyMap = new Map((companies || []).map((c: any) => [c.id, c.name || (c.name_encrypted ? decrypt(c.name_encrypted) : null) || c.company_name || 'Unknown']))

    // For guarantor chases, fetch the parent tenant names
    const guarantorItems = items.filter((i: any) => i.chase_type === 'GUARANTOR')
    const guarantorRefIds = guarantorItems.map((i: any) => i.reference_id).filter(Boolean)
    const parentTenantMap = new Map<string, string>()
    if (guarantorRefIds.length > 0) {
      const { data: guarantorRefs } = await supabase
        .from('tenant_references_v2')
        .select('id, guarantor_for_reference_id')
        .in('id', guarantorRefIds)
      const parentRefIds = (guarantorRefs || []).map(r => r.guarantor_for_reference_id).filter(Boolean)
      if (parentRefIds.length > 0) {
        const { data: parentRefs } = await supabase
          .from('tenant_references_v2')
          .select('id, tenant_first_name_encrypted, tenant_last_name_encrypted')
          .in('id', parentRefIds)
        const parentMap = new Map((parentRefs || []).map(r => [r.id, `${decrypt(r.tenant_first_name_encrypted)} ${decrypt(r.tenant_last_name_encrypted)}`.trim()]))
        for (const gRef of (guarantorRefs || [])) {
          if (gRef.guarantor_for_reference_id && parentMap.has(gRef.guarantor_for_reference_id)) {
            parentTenantMap.set(gRef.id, parentMap.get(gRef.guarantor_for_reference_id)!)
          }
        }
      }
    }

    // Transform to frontend format
    const enrichedItems = items.map((item: any) => {
      let tenantName = item.reference
        ? `${decrypt(item.reference.tenant_first_name_encrypted)} ${decrypt(item.reference.tenant_last_name_encrypted)}`
        : 'Unknown'
      // For guarantor chases, tenant_name should be the parent tenant (not the guarantor)
      if (item.chase_type === 'GUARANTOR' && parentTenantMap.has(item.reference_id)) {
        tenantName = parentTenantMap.get(item.reference_id)!
      }

      const hoursWaiting = item.chase_queue_entered_at
        ? Math.round((Date.now() - new Date(item.chase_queue_entered_at).getTime()) / (1000 * 60 * 60))
        : 0

      return {
        id: item.id,
        reference_id: item.reference_id,
        section_type: item.section?.section_type || null,
        chase_type: item.chase_type || 'REFEREE',
        contact_type: item.referee_type,
        referee_type: item.referee_type,
        contact_name: decrypt(item.referee_name_encrypted) || 'Unknown',
        referee_name: decrypt(item.referee_name_encrypted) || 'Unknown',
        contact_email: decrypt(item.referee_email_encrypted) || '',
        referee_email: decrypt(item.referee_email_encrypted) || '',
        contact_phone: decrypt(item.referee_phone_encrypted) || null,
        referee_phone: decrypt(item.referee_phone_encrypted) || null,
        tenant_name: tenantName,
        property_address: item.reference
          ? decrypt(item.reference.property_address_encrypted)
          : 'Unknown',
        company_name: companyMap.get(item.reference?.company_id) || 'Unknown',
        chase_count: item.chase_count || 0,
        next_chase_due: item.next_chase_due || null,
        last_chased_at: item.last_chased_at,
        chase_method: null,
        hours_waiting: hoursWaiting,
        age_hours: hoursWaiting,
        urgency: hoursWaiting > 72 ? 'URGENT' : hoursWaiting > 48 ? 'WARNING' : 'NORMAL',
        chase_history: item.chase_history || [],
        created_at: item.created_at,
        email_checked: item.email_checked || false,
        call_checked: item.call_checked || false,
        cooldown_until: item.cooldown_until || null,
        chase_note: item.chase_note || null,
        is_overdue: item.is_overdue || false,
        in_cooldown: item.in_cooldown || false
      }
    })

    res.json({ items: enrichedItems })
  } catch (error: any) {
    console.error('[V2 Chase] Error getting chase queue:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Get single chase item details
 */
router.get('/:id', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    const { id } = req.params

    const result = await getChaseItemDecrypted(id)
    if (!result) {
      return res.status(404).json({ error: 'Chase item not found' })
    }

    // Get form template for verbal reference
    const formTemplate = getFormTemplate(result.chaseItem.referee_type)

    res.json({
      ...result,
      formTemplate
    })
  } catch (error: any) {
    console.error('[V2 Chase] Error getting chase item:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Get form link for a chase item's referee
 */
router.get('/:id/form-link', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    const { id } = req.params

    // Get chase item to find the referee
    const { data: chaseItem } = await supabase
      .from('chase_items_v2')
      .select('id, reference_id, referee_type')
      .eq('id', id)
      .single()

    if (!chaseItem) {
      return res.status(404).json({ error: 'Chase item not found' })
    }

    // Find the referee with a form token
    const { data: referee } = await supabase
      .from('referees_v2')
      .select('id, referee_type, form_token')
      .eq('reference_id', chaseItem.reference_id)
      .eq('referee_type', chaseItem.referee_type)
      .is('completed_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!referee?.form_token) {
      return res.json({ formUrl: null })
    }

    const frontendUrl = process.env.NODE_ENV === 'production'
      ? 'https://app.propertygoose.co.uk'
      : 'http://localhost:5173'

    const formTypeMap: Record<string, string> = {
      EMPLOYER: 'employer-reference',
      LANDLORD: 'landlord-reference',
      ACCOUNTANT: 'accountant-reference',
      AGENT: 'agent-reference'
    }

    const formType = formTypeMap[chaseItem.referee_type] || 'employer-reference'
    const formUrl = `${frontendUrl}/v2/${formType}/${referee.form_token}`

    res.json({ formUrl })
  } catch (error: any) {
    console.error('[V2 Chase] Error getting form link:', error)
    res.status(500).json({ error: error.message })
  }
})

// ============================================================================
// CHASE ACTIONS
// ============================================================================

/**
 * Send chase email
 */
router.post('/:id/email', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    const { id } = req.params
    const staffUser = req.staffUser

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' })
    }

    const result = await getChaseItemDecrypted(id)
    if (!result) {
      return res.status(404).json({ error: 'Chase item not found' })
    }

    const { chaseItem, refereeName, refereeEmail } = result

    // Get reference and company details
    const { data: reference } = await supabase
      .from('tenant_references_v2')
      .select(`
        id,
        company_id,
        tenant_first_name_encrypted,
        tenant_last_name_encrypted,
        companies:company_id (
          name_encrypted,
          phone_encrypted,
          email_encrypted,
          logo_url
        )
      `)
      .eq('id', chaseItem.reference_id)
      .single()

    if (!reference) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    const tenantName = `${decrypt(reference.tenant_first_name_encrypted)} ${decrypt(reference.tenant_last_name_encrypted)}`.trim()
    const company = reference.companies as any
    const companyName = company ? decrypt(company.name_encrypted) || '' : ''
    const companyPhone = company ? decrypt(company.phone_encrypted) || '' : ''
    const companyEmail = company ? decrypt(company.email_encrypted) || '' : ''
    const logoUrl = company?.logo_url

    // Look up referee form token to build correct URL
    const { data: referee } = await supabase
      .from('referees_v2')
      .select('id, form_token_hash')
      .eq('reference_id', chaseItem.reference_id)
      .eq('referee_type', chaseItem.referee_type)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const refereeTypeToPath: Record<string, string> = {
      'EMPLOYER': 'v2/employer-reference',
      'LANDLORD': 'v2/landlord-reference',
      'ACCOUNTANT': 'v2/accountant-reference'
    }
    // Use the chase item's section_id as fallback token if no referee found
    const refereePath = refereeTypeToPath[chaseItem.referee_type] || 'v2/employer-reference'
    // Generate a new token for the chase email (referee already has one from initial creation)
    const formToken = generateToken()
    const formTokenHash = hash(formToken)
    // Update the referee with new token so the link works
    if (referee) {
      await supabase.from('referees_v2').update({ form_token: formToken, form_token_hash: formTokenHash }).eq('id', referee.id)
    }
    const formUrl = `${frontendUrl}/${refereePath}/${formToken}`

    // Send email based on referee type
    try {
      switch (chaseItem.referee_type) {
        case 'EMPLOYER':
          await sendEmployerReferenceRequest(
            refereeEmail, refereeName, tenantName, formUrl,
            companyName, companyPhone, companyEmail, reference.id, logoUrl
          )
          break
        case 'LANDLORD':
          await sendLandlordReferenceRequest(
            refereeEmail, refereeName, tenantName, formUrl,
            companyName, companyPhone, companyEmail, reference.id, logoUrl
          )
          break
        case 'AGENT':
          await sendAgentReferenceRequest(
            refereeEmail, refereeName, tenantName, formUrl,
            companyName, companyPhone, companyEmail, reference.id, logoUrl
          )
          break
        case 'ACCOUNTANT':
          await sendAccountantReferenceRequest(
            refereeEmail, refereeName, tenantName, formUrl,
            companyName, companyPhone, companyEmail, reference.id
          )
          break
      }
    } catch (emailError) {
      console.error('[V2 Chase] Email send error:', emailError)
      return res.status(500).json({ error: 'Failed to send email' })
    }

    // Record the action
    await recordChaseAction(id, 'EMAIL', staffUser.id)

    res.json({ message: 'Chase email sent', chaseItemId: id })
  } catch (error: any) {
    console.error('[V2 Chase] Error sending chase email:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Send chase SMS
 */
router.post('/:id/sms', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    const { id } = req.params
    const staffUser = req.staffUser

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' })
    }

    const result = await getChaseItemDecrypted(id)
    if (!result) {
      return res.status(404).json({ error: 'Chase item not found' })
    }

    const { chaseItem, refereeName, refereePhone } = result

    if (!refereePhone) {
      return res.status(400).json({ error: 'No phone number available for this referee' })
    }

    // Get reference details
    const { data: reference } = await supabase
      .from('tenant_references_v2')
      .select('id, tenant_first_name_encrypted, tenant_last_name_encrypted')
      .eq('id', chaseItem.reference_id)
      .single()

    if (!reference) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    const tenantName = `${decrypt(reference.tenant_first_name_encrypted)} ${decrypt(reference.tenant_last_name_encrypted)}`.trim()
    // Build referee form URL with correct path per type
    const _refTypeToPath: Record<string, string> = { 'EMPLOYER': 'v2/employer-reference', 'LANDLORD': 'v2/landlord-reference', 'ACCOUNTANT': 'v2/accountant-reference' }
    const _refPath = _refTypeToPath[chaseItem.referee_type] || 'v2/employer-reference'
    const _chaseToken = generateToken()
    const _chaseTokenHash = hash(_chaseToken)
    const { data: _chaseRef } = await supabase.from('referees_v2').select('id').eq('reference_id', chaseItem.reference_id).eq('referee_type', chaseItem.referee_type).order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (_chaseRef) await supabase.from('referees_v2').update({ form_token: _chaseToken, form_token_hash: _chaseTokenHash }).eq('id', _chaseRef.id)
    const formUrl = `${frontendUrl}/${_refPath}/${_chaseToken}`

    // Send SMS based on referee type
    try {
      switch (chaseItem.referee_type) {
        case 'EMPLOYER':
          await sendEmployerReferenceRequestSMS(refereePhone, refereeName, tenantName, formUrl, reference.id)
          break
        case 'LANDLORD':
          await sendLandlordReferenceRequestSMS(refereePhone, refereeName, tenantName, formUrl, reference.id)
          break
        case 'AGENT':
          await sendAgentReferenceRequestSMS(refereePhone, refereeName, tenantName, formUrl, reference.id)
          break
        case 'ACCOUNTANT':
          await sendAccountantReferenceRequestSMS(refereePhone, refereeName, tenantName, formUrl, reference.id)
          break
      }
    } catch (smsError) {
      console.error('[V2 Chase] SMS send error:', smsError)
      return res.status(500).json({ error: 'Failed to send SMS' })
    }

    // Record the action
    await recordChaseAction(id, 'SMS', staffUser.id)

    res.json({ message: 'Chase SMS sent', chaseItemId: id })
  } catch (error: any) {
    console.error('[V2 Chase] Error sending chase SMS:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Log call attempt
 */
router.post('/:id/call', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    const { id } = req.params
    const staffUser = req.staffUser
    const { outcome, notes } = req.body

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' })
    }

    await recordChaseAction(id, 'CALL', staffUser.id, notes)

    res.json({ message: 'Call logged', chaseItemId: id, outcome })
  } catch (error: any) {
    console.error('[V2 Chase] Error logging call:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Record verbal reference
 */
router.post('/:id/verbal', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    const { id } = req.params
    const staffUser = req.staffUser
    const {
      refereeName,
      refereePosition,
      refereePhone,
      callDatetime,
      callDurationMinutes,
      responses
    } = req.body

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' })
    }

    // Get chase item
    const result = await getChaseItemDecrypted(id)
    if (!result) {
      return res.status(404).json({ error: 'Chase item not found' })
    }

    const { chaseItem } = result

    // Validate required fields
    if (!refereeName || !refereePhone || !callDatetime || !responses) {
      return res.status(400).json({ error: 'Missing required fields: refereeName, refereePhone, callDatetime, responses' })
    }

    // Validate responses based on referee type
    let validation: { valid: boolean; errors: string[] }
    if (chaseItem.referee_type === 'EMPLOYER') {
      validation = validateEmployerResponses(responses)
    } else if (chaseItem.referee_type === 'LANDLORD' || chaseItem.referee_type === 'AGENT') {
      validation = validateLandlordResponses(responses)
    } else {
      validation = { valid: true, errors: [] } // Accountant - less strict validation
    }

    if (!validation.valid) {
      return res.status(400).json({ error: 'Invalid responses', details: validation.errors })
    }

    if (!chaseItem.section_id) {
      return res.status(400).json({ error: 'Cannot record verbal reference for tenant chase items' })
    }

    // Record verbal reference
    const input: RecordVerbalReferenceInput = {
      referenceId: chaseItem.reference_id,
      sectionId: chaseItem.section_id,
      chaseItemId: id,
      refereeType: chaseItem.referee_type,
      refereeName,
      refereePosition,
      refereePhone,
      callDatetime: new Date(callDatetime),
      callDurationMinutes,
      responses,
      staffUserId: staffUser.id
    }

    const verbalRef = await recordVerbalReference(input)
    if (!verbalRef) {
      return res.status(500).json({ error: 'Failed to record verbal reference' })
    }

    res.json({
      message: 'Verbal reference recorded',
      verbalReferenceId: verbalRef.id,
      chaseItemId: id
    })
  } catch (error: any) {
    console.error('[V2 Chase] Error recording verbal reference:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Mark chase as unable to obtain
 */
router.post('/:id/unable', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    const { id } = req.params
    const { reason } = req.body

    if (!reason) {
      return res.status(400).json({ error: 'Reason required' })
    }

    const success = await markChaseUnable(id, reason)
    if (!success) {
      return res.status(500).json({ error: 'Failed to mark as unable' })
    }

    res.json({ message: 'Marked as unable to obtain', chaseItemId: id })
  } catch (error: any) {
    console.error('[V2 Chase] Error marking unable:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Complete chase cycle (email + call done, note submitted)
 */
router.post('/:id/complete-chase', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    const { id } = req.params
    const { note } = req.body
    const staffUser = req.staffUser

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' })
    }

    if (!note || typeof note !== 'string') {
      return res.status(400).json({ error: 'Note is required' })
    }

    const success = await completeChaseCycle(id, note, staffUser.id)
    if (!success) {
      return res.status(500).json({ error: 'Failed to complete chase cycle' })
    }

    res.json({ message: 'Chase cycle completed', chaseItemId: id })
  } catch (error: any) {
    console.error('[V2 Chase] Error completing chase cycle:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Send tenant chase email (resend tenant form link)
 */
router.post('/:id/tenant-chase-email', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    const { id } = req.params
    const staffUser = req.staffUser

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' })
    }

    // Get chase item and verify it's a tenant chase
    const chaseItem = await getChaseItem(id)
    if (!chaseItem) {
      return res.status(404).json({ error: 'Chase item not found' })
    }
    if (chaseItem.chase_type !== 'TENANT' && chaseItem.chase_type !== 'GUARANTOR') {
      return res.status(400).json({ error: 'This endpoint is only for tenant/guarantor chases' })
    }

    // Get the reference
    const { data: reference } = await supabase
      .from('tenant_references_v2')
      .select(`
        id,
        company_id,
        is_guarantor,
        tenant_first_name_encrypted,
        tenant_last_name_encrypted,
        tenant_email_encrypted,
        property_address_encrypted,
        companies:company_id (
          name_encrypted,
          phone_encrypted,
          email_encrypted,
          logo_url
        )
      `)
      .eq('id', chaseItem.reference_id)
      .single()

    if (!reference) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    // Generate new form token
    const newToken = generateToken()
    const newTokenHash = hash(newToken)

    await supabase
      .from('tenant_references_v2')
      .update({ form_token_hash: newTokenHash, updated_at: new Date().toISOString() })
      .eq('id', reference.id)

    const tenantName = `${decrypt(reference.tenant_first_name_encrypted)} ${decrypt(reference.tenant_last_name_encrypted)}`.trim()
    const tenantEmail = decrypt(reference.tenant_email_encrypted) || ''
    const company = reference.companies as any
    const companyName = company ? decrypt(company.name_encrypted) || '' : ''
    const companyPhone = company ? decrypt(company.phone_encrypted) || '' : ''
    const companyEmail = company ? decrypt(company.email_encrypted) || '' : ''
    const logoUrl = company?.logo_url
    const propertyAddress = decrypt(reference.property_address_encrypted) || ''

    const isGuarantor = reference.is_guarantor || false
    const formPath = isGuarantor ? 'guarantor-reference-v2' : 'submit-reference-v2'
    const formUrl = `${frontendUrl}/${formPath}/${newToken}`

    if (isGuarantor) {
      // Get parent tenant name for guarantor email
      const { data: parentRef } = await supabase
        .from('tenant_references_v2')
        .select('tenant_first_name_encrypted, tenant_last_name_encrypted')
        .eq('guarantor_reference_id', reference.id)
        .maybeSingle()
      const parentTenantName = parentRef
        ? `${decrypt(parentRef.tenant_first_name_encrypted)} ${decrypt(parentRef.tenant_last_name_encrypted)}`.trim()
        : 'the tenant'

      const { sendGuarantorReferenceRequest } = await import('../../services/emailService')
      await sendGuarantorReferenceRequest(
        tenantEmail, tenantName, parentTenantName, propertyAddress,
        companyName, companyPhone, companyEmail, formUrl, reference.id, logoUrl
      )
    } else {
      await sendTenantReferenceRequest(
        tenantEmail, tenantName, formUrl,
        companyName, propertyAddress, companyPhone, companyEmail, reference.id, logoUrl
      )
    }

    // Mark email_checked on the chase item
    await supabase
      .from('chase_items_v2')
      .update({ email_checked: true, updated_at: new Date().toISOString() })
      .eq('id', id)

    await recordChaseAction(id, 'EMAIL', staffUser.id)

    res.json({ message: 'Tenant chase email sent', chaseItemId: id })
  } catch (error: any) {
    console.error('[V2 Chase] Error sending tenant chase email:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Mark chase item as called
 */
router.post('/:id/check-called', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    const { id } = req.params
    const staffUser = req.staffUser

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' })
    }

    const { error } = await supabase
      .from('chase_items_v2')
      .update({ call_checked: true, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      return res.status(500).json({ error: 'Failed to update chase item' })
    }

    await recordChaseAction(id, 'CALL', staffUser.id)

    res.json({ message: 'Call checked', chaseItemId: id })
  } catch (error: any) {
    console.error('[V2 Chase] Error checking called:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Send chase (unified endpoint for EMAIL or SMS)
 * Frontend sends { method: 'EMAIL' | 'SMS' }
 */
router.post('/:id/send', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    const { id } = req.params
    const { method } = req.body
    const staffUser = req.staffUser

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' })
    }

    if (!method || !['EMAIL', 'SMS'].includes(method)) {
      return res.status(400).json({ error: 'Invalid method. Must be EMAIL or SMS' })
    }

    const result = await getChaseItemDecrypted(id)
    if (!result) {
      return res.status(404).json({ error: 'Chase item not found' })
    }

    const { chaseItem, refereeName, refereeEmail, refereePhone } = result

    // Get reference and company details
    const { data: reference } = await supabase
      .from('tenant_references_v2')
      .select(`
        id,
        company_id,
        tenant_first_name_encrypted,
        tenant_last_name_encrypted,
        companies:company_id (
          name_encrypted,
          phone_encrypted,
          email_encrypted,
          logo_url
        )
      `)
      .eq('id', chaseItem.reference_id)
      .single()

    if (!reference) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    const tenantName = `${decrypt(reference.tenant_first_name_encrypted)} ${decrypt(reference.tenant_last_name_encrypted)}`.trim()
    const company = reference.companies as any
    const companyName = company ? decrypt(company.name_encrypted) || '' : ''
    const companyPhone = company ? decrypt(company.phone_encrypted) || '' : ''
    const companyEmail = company ? decrypt(company.email_encrypted) || '' : ''
    const logoUrl = company?.logo_url
    // Build referee form URL with correct path per type
    const _refTypeToPath: Record<string, string> = { 'EMPLOYER': 'v2/employer-reference', 'LANDLORD': 'v2/landlord-reference', 'ACCOUNTANT': 'v2/accountant-reference' }
    const _refPath = _refTypeToPath[chaseItem.referee_type] || 'v2/employer-reference'
    const _chaseToken = generateToken()
    const _chaseTokenHash = hash(_chaseToken)
    const { data: _chaseRef } = await supabase.from('referees_v2').select('id').eq('reference_id', chaseItem.reference_id).eq('referee_type', chaseItem.referee_type).order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (_chaseRef) await supabase.from('referees_v2').update({ form_token: _chaseToken, form_token_hash: _chaseTokenHash }).eq('id', _chaseRef.id)
    const formUrl = `${frontendUrl}/${_refPath}/${_chaseToken}`

    if (method === 'EMAIL') {
      if (!refereeEmail) {
        return res.status(400).json({ error: 'No email address available' })
      }

      switch (chaseItem.referee_type) {
        case 'EMPLOYER':
          await sendEmployerReferenceRequest(
            refereeEmail, refereeName, tenantName, formUrl,
            companyName, companyPhone, companyEmail, reference.id, logoUrl
          )
          break
        case 'LANDLORD':
          await sendLandlordReferenceRequest(
            refereeEmail, refereeName, tenantName, formUrl,
            companyName, companyPhone, companyEmail, reference.id, logoUrl
          )
          break
        case 'AGENT':
          await sendAgentReferenceRequest(
            refereeEmail, refereeName, tenantName, formUrl,
            companyName, companyPhone, companyEmail, reference.id, logoUrl
          )
          break
        case 'ACCOUNTANT':
          await sendAccountantReferenceRequest(
            refereeEmail, refereeName, tenantName, formUrl,
            companyName, companyPhone, companyEmail, reference.id
          )
          break
      }
    } else {
      // SMS
      if (!refereePhone) {
        return res.status(400).json({ error: 'No phone number available' })
      }

      switch (chaseItem.referee_type) {
        case 'EMPLOYER':
          await sendEmployerReferenceRequestSMS(refereePhone, refereeName, tenantName, formUrl, reference.id)
          break
        case 'LANDLORD':
          await sendLandlordReferenceRequestSMS(refereePhone, refereeName, tenantName, formUrl, reference.id)
          break
        case 'AGENT':
          await sendAgentReferenceRequestSMS(refereePhone, refereeName, tenantName, formUrl, reference.id)
          break
        case 'ACCOUNTANT':
          await sendAccountantReferenceRequestSMS(refereePhone, refereeName, tenantName, formUrl, reference.id)
          break
      }
    }

    // Record the action
    await recordChaseAction(id, method, staffUser.id)

    res.json({ message: `Chase ${method.toLowerCase()} sent`, chaseItemId: id })
  } catch (error: any) {
    console.error('[V2 Chase] Error sending chase:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Mark reference as received
 */
router.post('/:id/received', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    const { id } = req.params

    // Update chase item status to RECEIVED
    const { error } = await supabase
      .from('chase_items_v2')
      .update({
        status: 'RECEIVED',
        resolved_at: new Date().toISOString(),
        resolution_type: 'ONLINE_FORM',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    if (error) {
      throw error
    }

    res.json({ message: 'Marked as received', chaseItemId: id })
  } catch (error: any) {
    console.error('[V2 Chase] Error marking received:', error)
    res.status(500).json({ error: error.message })
  }
})

// ============================================================================
// FRONTEND ALIAS ROUTES
// These provide alternative endpoint names used by the frontend
// ============================================================================

/**
 * Resend email (alias for /email)
 */
router.post('/:id/resend-email', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    const { id } = req.params
    const staffUser = req.staffUser

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' })
    }

    const result = await getChaseItemDecrypted(id)
    if (!result) {
      return res.status(404).json({ error: 'Chase item not found' })
    }

    const { chaseItem, refereeName, refereeEmail } = result

    const { data: reference } = await supabase
      .from('tenant_references_v2')
      .select(`
        id,
        company_id,
        tenant_first_name_encrypted,
        tenant_last_name_encrypted,
        companies:company_id (
          name_encrypted,
          phone_encrypted,
          email_encrypted,
          logo_url
        )
      `)
      .eq('id', chaseItem.reference_id)
      .single()

    if (!reference) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    const tenantName = `${decrypt(reference.tenant_first_name_encrypted)} ${decrypt(reference.tenant_last_name_encrypted)}`.trim()
    const company = reference.companies as any
    const companyName = company ? decrypt(company.name_encrypted) || '' : ''
    const companyPhone = company ? decrypt(company.phone_encrypted) || '' : ''
    const companyEmail = company ? decrypt(company.email_encrypted) || '' : ''
    const logoUrl = company?.logo_url
    // Build referee form URL with correct path per type
    const _refTypeToPath: Record<string, string> = { 'EMPLOYER': 'v2/employer-reference', 'LANDLORD': 'v2/landlord-reference', 'ACCOUNTANT': 'v2/accountant-reference' }
    const _refPath = _refTypeToPath[chaseItem.referee_type] || 'v2/employer-reference'
    const _chaseToken = generateToken()
    const _chaseTokenHash = hash(_chaseToken)
    const { data: _chaseRef } = await supabase.from('referees_v2').select('id').eq('reference_id', chaseItem.reference_id).eq('referee_type', chaseItem.referee_type).order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (_chaseRef) await supabase.from('referees_v2').update({ form_token: _chaseToken, form_token_hash: _chaseTokenHash }).eq('id', _chaseRef.id)
    const formUrl = `${frontendUrl}/${_refPath}/${_chaseToken}`

    switch (chaseItem.referee_type) {
      case 'EMPLOYER':
        await sendEmployerReferenceRequest(
          refereeEmail, refereeName, tenantName, formUrl,
          companyName, companyPhone, companyEmail, reference.id, logoUrl
        )
        break
      case 'LANDLORD':
        await sendLandlordReferenceRequest(
          refereeEmail, refereeName, tenantName, formUrl,
          companyName, companyPhone, companyEmail, reference.id, logoUrl
        )
        break
      case 'AGENT':
        await sendAgentReferenceRequest(
          refereeEmail, refereeName, tenantName, formUrl,
          companyName, companyPhone, companyEmail, reference.id, logoUrl
        )
        break
      case 'ACCOUNTANT':
        await sendAccountantReferenceRequest(
          refereeEmail, refereeName, tenantName, formUrl,
          companyName, companyPhone, companyEmail, reference.id
        )
        break
    }

    await recordChaseAction(id, 'EMAIL', staffUser.id)
    res.json({ message: 'Chase email resent', chaseItemId: id })
  } catch (error: any) {
    console.error('[V2 Chase] Error resending email:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Send SMS (alias for /sms)
 */
router.post('/:id/send-sms', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    const { id } = req.params
    const staffUser = req.staffUser

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' })
    }

    const result = await getChaseItemDecrypted(id)
    if (!result) {
      return res.status(404).json({ error: 'Chase item not found' })
    }

    const { chaseItem, refereeName, refereePhone } = result

    if (!refereePhone) {
      return res.status(400).json({ error: 'No phone number available' })
    }

    const { data: reference } = await supabase
      .from('tenant_references_v2')
      .select('id, tenant_first_name_encrypted, tenant_last_name_encrypted')
      .eq('id', chaseItem.reference_id)
      .single()

    if (!reference) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    const tenantName = `${decrypt(reference.tenant_first_name_encrypted)} ${decrypt(reference.tenant_last_name_encrypted)}`.trim()
    // Build referee form URL with correct path per type
    const _refTypeToPath: Record<string, string> = { 'EMPLOYER': 'v2/employer-reference', 'LANDLORD': 'v2/landlord-reference', 'ACCOUNTANT': 'v2/accountant-reference' }
    const _refPath = _refTypeToPath[chaseItem.referee_type] || 'v2/employer-reference'
    const _chaseToken = generateToken()
    const _chaseTokenHash = hash(_chaseToken)
    const { data: _chaseRef } = await supabase.from('referees_v2').select('id').eq('reference_id', chaseItem.reference_id).eq('referee_type', chaseItem.referee_type).order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (_chaseRef) await supabase.from('referees_v2').update({ form_token: _chaseToken, form_token_hash: _chaseTokenHash }).eq('id', _chaseRef.id)
    const formUrl = `${frontendUrl}/${_refPath}/${_chaseToken}`

    switch (chaseItem.referee_type) {
      case 'EMPLOYER':
        await sendEmployerReferenceRequestSMS(refereePhone, refereeName, tenantName, formUrl, reference.id)
        break
      case 'LANDLORD':
        await sendLandlordReferenceRequestSMS(refereePhone, refereeName, tenantName, formUrl, reference.id)
        break
      case 'AGENT':
        await sendAgentReferenceRequestSMS(refereePhone, refereeName, tenantName, formUrl, reference.id)
        break
      case 'ACCOUNTANT':
        await sendAccountantReferenceRequestSMS(refereePhone, refereeName, tenantName, formUrl, reference.id)
        break
    }

    await recordChaseAction(id, 'SMS', staffUser.id)
    res.json({ message: 'Chase SMS sent', chaseItemId: id })
  } catch (error: any) {
    console.error('[V2 Chase] Error sending SMS:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Log call (alias for /call)
 */
router.post('/:id/log-call', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    const { id } = req.params
    const staffUser = req.staffUser
    const { outcome, notes } = req.body

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' })
    }

    await recordChaseAction(id, 'CALL', staffUser.id, notes)
    res.json({ message: 'Call logged', chaseItemId: id, outcome })
  } catch (error: any) {
    console.error('[V2 Chase] Error logging call:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Mark chase item as received (manual)
 */
router.post('/:id/mark-received', authenticateStaff, async (req: StaffAuthRequest, res) => {
  try {
    const { id } = req.params
    const staffUser = req.staffUser

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' })
    }

    // Get chase item with its linked section
    const { data: chaseItem, error: fetchError } = await supabase
      .from('chase_items_v2')
      .select(`
        id, reference_id, section_id,
        section:reference_sections_v2!chase_items_v2_section_id_fkey (
          id, section_type
        )
      `)
      .eq('id', id)
      .single()

    if (fetchError || !chaseItem) {
      console.error('[V2 Chase] mark-received fetch error:', fetchError)
      return res.status(404).json({ error: 'Chase item not found' })
    }

    // Mark chase as received
    const { error: updateError } = await supabase
      .from('chase_items_v2')
      .update({
        status: 'RECEIVED',
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    if (updateError) {
      console.error('[V2 Chase] mark-received update error:', updateError)
      return res.status(500).json({ error: 'Failed to update chase item' })
    }

    // Move the related section to READY if still PENDING
    const sectionType = (chaseItem.section as any)?.section_type
    if (sectionType) {
      await supabase
        .from('reference_sections_v2')
        .update({
          queue_status: 'READY',
          referee_submitted_at: new Date().toISOString(),
          queue_entered_at: new Date().toISOString()
        })
        .eq('reference_id', chaseItem.reference_id)
        .eq('section_type', sectionType)
        .eq('queue_status', 'PENDING')
    }

    console.log(`[V2 Chase] Chase item ${id} manually marked as received`)
    res.json({ message: 'Chase item marked as received', chaseItemId: id })
  } catch (error: any) {
    console.error('[V2 Chase] Error marking received:', error)
    res.status(500).json({ error: error.message })
  }
})

export default router
