import { Router } from 'express'
import { verifyRTRShareCode } from '../services/rtrService'
import { supabase } from '../config/supabase'
import { hash } from '../services/encryption'

const router = Router()

// Verify Right to Rent share code
router.post('/verify', async (req, res) => {
  try {
    const { shareCode, firstName, lastName, dateOfBirth, referenceToken } = req.body

    // Validate required fields
    if (!shareCode) {
      return res.status(400).json({ error: 'Share code is required' })
    }
    if (!firstName) {
      return res.status(400).json({ error: 'First name is required' })
    }
    if (!lastName) {
      return res.status(400).json({ error: 'Last name is required' })
    }
    if (!dateOfBirth) {
      return res.status(400).json({ error: 'Date of birth is required' })
    }

    // Get company details from reference token
    let companyName = 'PropertyGoose'
    let referenceExists = false

    if (referenceToken) {
      const tokenHash = hash(referenceToken)
      const { data: reference, error: dbError } = await supabase
        .from('tenant_references')
        .select('company_name')
        .eq('token_hash', tokenHash)
        .single()

      if (reference) {
        referenceExists = true
        if (reference.company_name) {
          companyName = reference.company_name
        }
      }
      // Don't fail if reference not found - still allow verification
      // This allows testing and handles edge cases
    }

    // Call RTR verification service with all required fields
    const result = await verifyRTRShareCode({
      shareCode,
      firstName,
      lastName,
      dateOfBirth, // Should be in DD-MM-YYYY format
      checkerType: 'agent',
      checkerName: companyName
    })

    if (result.verified) {
      // Store verification result if we have a valid reference token
      if (referenceToken && referenceExists) {
        const tokenHash = hash(referenceToken)
        await supabase
          .from('tenant_references')
          .update({
            rtr_verified: true,
            rtr_share_code: shareCode,
            rtr_verification_date: new Date().toISOString(),
            rtr_verification_data: result
          })
          .eq('token_hash', tokenHash)
      }

      return res.json({
        message: 'Right to Rent verified successfully',
        ...result
      })
    } else {
      return res.status(400).json({
        verified: false,
        message: result.errorMessage || 'Unable to verify Right to Rent'
      })
    }
  } catch (error: any) {
    console.error('RTR verification error:', error)
    return res.status(500).json({
      verified: false,
      message: 'An error occurred during verification'
    })
  }
})

export default router
