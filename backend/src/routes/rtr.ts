import { Router } from 'express'
import { verifyRTRShareCode } from '../services/rtrService'
import { supabase } from '../config/supabase'
import { hash } from '../services/encryption'

const router = Router()

// Verify Right to Rent share code
router.post('/verify', async (req, res) => {
  try {
    const { shareCode, referenceToken } = req.body

    if (!shareCode) {
      return res.status(400).json({ error: 'Share code is required' })
    }

    // Verify the reference token exists
    if (referenceToken) {
      const tokenHash = hash(referenceToken)
      const { data: reference } = await supabase
        .from('tenant_references')
        .select('id')
        .eq('token_hash', tokenHash)
        .single()

      if (!reference) {
        return res.status(404).json({ error: 'Invalid reference token' })
      }
    }

    // Call RTR verification service
    const result = await verifyRTRShareCode(shareCode)

    if (result.verified) {
      // Store verification result if we have a reference token
      if (referenceToken) {
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
        verified: true,
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
