/**
 * V2 Public Verification Routes
 *
 * Public endpoints for verifying reference reports via QR code.
 */

import { Router, Request, Response } from 'express'
import { supabase } from '../../config/supabase'
import { decrypt } from '../../services/encryption'

const router = Router()

/**
 * Verify a reference report (public endpoint)
 * Returns limited, non-sensitive information for verification
 */
router.get('/:referenceId', async (req: Request, res: Response) => {
  try {
    const { referenceId } = req.params

    // Fetch reference
    const { data: reference, error: refError } = await supabase
      .from('tenant_references_v2')
      .select('id, status, final_decision_at, report_generated_at, tenant_first_name_encrypted, tenant_last_name_encrypted, property_address_encrypted, property_city_encrypted')
      .eq('id', referenceId)
      .single()

    if (refError || !reference) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    // Only return verification info for finalized references
    const finalStatuses = ['ACCEPTED', 'ACCEPTED_WITH_GUARANTOR', 'ACCEPTED_ON_CONDITION', 'REJECTED']
    if (!finalStatuses.includes(reference.status)) {
      return res.status(400).json({ error: 'Reference has not been finalized' })
    }

    // Fetch section decisions (without sensitive details)
    const { data: sections } = await supabase
      .from('reference_sections_v2')
      .select('section_type, decision')
      .eq('reference_id', referenceId)

    // Decrypt and mask tenant name (show first name + last initial)
    const firstName = decrypt(reference.tenant_first_name_encrypted || '') || ''
    const lastName = decrypt(reference.tenant_last_name_encrypted || '') || ''
    const maskedName = firstName ? `${firstName} ${lastName.charAt(0)}.` : 'Applicant'

    // Decrypt and truncate property address
    const propertyAddress = decrypt(reference.property_address_encrypted || '') || ''
    const propertyCity = decrypt(reference.property_city_encrypted || '') || ''
    const truncatedAddress = propertyAddress
      ? `${propertyAddress.substring(0, 30)}${propertyAddress.length > 30 ? '...' : ''}, ${propertyCity}`
      : 'Property'

    res.json({
      id: reference.id,
      status: reference.status,
      tenantName: maskedName,
      propertyAddress: truncatedAddress,
      decidedAt: reference.final_decision_at,
      reportGeneratedAt: reference.report_generated_at,
      sections: (sections || []).map(s => ({
        type: s.section_type,
        decision: s.decision
      })),
      verified: true,
      verifiedAt: new Date().toISOString()
    })
  } catch (error: any) {
    console.error('[V2 Verify] Error:', error)
    res.status(500).json({ error: error.message })
  }
})

export default router
