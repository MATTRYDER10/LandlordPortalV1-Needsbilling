/**
 * V2 Mobile Capture Routes
 *
 * Handles mobile photo capture for ID verification.
 * Generates short-lived capture links that tenants open on their phone
 * to photograph their ID document and take a selfie.
 */

import crypto from 'crypto'
import express, { Request, Response, Router } from 'express'
import { supabase } from '../../config/supabase'
import { decrypt, generateToken, hash } from '../../services/encryption'
import { getReferenceByFormToken } from '../../services/v2/referenceServiceV2'
import { getFrontendUrl, getV2FrontendUrl } from '../../utils/frontendUrl'

const router: Router = express.Router()

// POST /api/v2/mobile-capture/generate/:formToken - Generate a mobile capture session
router.post('/generate/:formToken', async (req: Request, res: Response) => {
  try {
    const { formToken } = req.params

    // Validate the form token
    const reference = await getReferenceByFormToken(formToken)

    if (!reference) {
      return res.status(404).json({ error: 'Reference not found or link expired' })
    }

    // Generate a capture token and session ID
    const captureToken = generateToken()
    const sessionId = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 minutes

    // Each row needs a unique token_hash (DB constraint), but we look up by session_id
    // Store the capture token hash on the first row so we can find the session from the token
    const idPhotoTokenHash = hash(captureToken)
    const selfieTokenHash = hash(captureToken + ':selfie')

    // Create two upload_links rows: one for ID photo, one for selfie
    const uploadLinksData = [
      {
        session_id: sessionId,
        reference_id: reference.id,
        token_hash: idPhotoTokenHash,
        field: 'id_photo',
        document_name: 'ID Photo',
        section: 'identity',
        expires_at: expiresAt
      },
      {
        session_id: sessionId,
        reference_id: reference.id,
        token_hash: selfieTokenHash,
        field: 'selfie',
        document_name: 'Selfie Photo',
        section: 'identity',
        expires_at: expiresAt
      }
    ]

    const { error: insertError } = await supabase
      .from('upload_links')
      .insert(uploadLinksData)

    if (insertError) {
      console.error('[MobileCapture] Error creating upload links:', insertError)
      return res.status(500).json({ error: 'Failed to create capture session' })
    }

    // Use LAN IP for mobile capture so phones on the same network can access it
    const frontendUrl = process.env.NODE_ENV === 'production' ? getV2FrontendUrl() : getFrontendUrl()
    const captureUrl = `${frontendUrl}/mobile-capture/${captureToken}`

    console.log('[MobileCapture] Created capture session:', sessionId, 'for reference:', reference.id)

    return res.json({
      captureToken,
      sessionId,
      captureUrl
    })
  } catch (error) {
    console.error('[MobileCapture] Error generating capture session:', error)
    return res.status(500).json({ error: 'Failed to generate capture session' })
  }
})

// GET /api/v2/mobile-capture/status/:formToken/:sessionId - Poll capture status
router.get('/status/:formToken/:sessionId', async (req: Request, res: Response) => {
  try {
    const { formToken, sessionId } = req.params

    // Validate the form token
    const reference = await getReferenceByFormToken(formToken)

    if (!reference) {
      return res.status(404).json({ error: 'Reference not found or link expired' })
    }

    // Look up upload_links by session_id
    const { data: uploadLinks, error } = await supabase
      .from('upload_links')
      .select('field, uploaded_file_path, uploaded_at')
      .eq('session_id', sessionId)

    if (error || !uploadLinks || uploadLinks.length === 0) {
      return res.status(404).json({ error: 'Capture session not found' })
    }

    const idPhotoLink = uploadLinks.find(l => l.field === 'id_photo')
    const selfieLink = uploadLinks.find(l => l.field === 'selfie')

    return res.json({
      idPhotoUploaded: !!idPhotoLink?.uploaded_at,
      selfieUploaded: !!selfieLink?.uploaded_at,
      idPhotoUrl: idPhotoLink?.uploaded_file_path || null,
      selfieUrl: selfieLink?.uploaded_file_path || null
    })
  } catch (error) {
    console.error('[MobileCapture] Error checking status:', error)
    return res.status(500).json({ error: 'Failed to check capture status' })
  }
})

// GET /api/v2/mobile-capture/:captureToken - Public info endpoint (no auth)
router.get('/:captureToken', async (req: Request, res: Response) => {
  try {
    const { captureToken } = req.params
    const tokenHash = hash(captureToken)

    // Look up upload_links by token_hash
    const { data: uploadLink, error } = await supabase
      .from('upload_links')
      .select('session_id, reference_id, expires_at')
      .eq('token_hash', tokenHash)
      .limit(1)
      .single()

    if (error || !uploadLink) {
      return res.status(404).json({ error: 'Capture link not found or expired' })
    }

    // Check expiry
    if (new Date(uploadLink.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Capture link has expired' })
    }

    // Get the reference to find company_id
    const { data: reference, error: refError } = await supabase
      .from('tenant_references_v2')
      .select('company_id')
      .eq('id', uploadLink.reference_id)
      .single()

    if (refError || !reference) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    // Get company info for branding
    const { data: company } = await supabase
      .from('companies')
      .select('name_encrypted, logo_url')
      .eq('id', reference.company_id)
      .single()

    const companyName = company?.name_encrypted ? (decrypt(company.name_encrypted) || 'PropertyGoose') : 'PropertyGoose'

    // Get all upload_links for this session to check upload status
    const { data: sessionLinks } = await supabase
      .from('upload_links')
      .select('field, uploaded_at')
      .eq('session_id', uploadLink.session_id)

    const idPhotoLink = sessionLinks?.find(l => l.field === 'id_photo')
    const selfieLink = sessionLinks?.find(l => l.field === 'selfie')

    return res.json({
      companyName,
      companyLogo: company?.logo_url || null,
      idPhotoUploaded: !!idPhotoLink?.uploaded_at,
      selfieUploaded: !!selfieLink?.uploaded_at,
      referenceId: uploadLink.reference_id,
      sessionId: uploadLink.session_id
    })
  } catch (error) {
    console.error('[MobileCapture] Error fetching capture info:', error)
    return res.status(500).json({ error: 'Failed to fetch capture info' })
  }
})

// POST /api/v2/mobile-capture/:captureToken/upload - Public upload endpoint (no auth)
router.post('/:captureToken/upload', async (req: Request, res: Response) => {
  try {
    const { captureToken } = req.params
    const { type, fileData, fileType, fileName } = req.body

    if (!type || !fileData || !fileType || !fileName) {
      return res.status(400).json({ error: 'Missing required fields: type, fileData, fileType, fileName' })
    }

    if (type !== 'id_photo' && type !== 'selfie') {
      return res.status(400).json({ error: 'Invalid type. Must be "id_photo" or "selfie"' })
    }

    const tokenHash = hash(captureToken)

    // Look up upload_links by token_hash
    const { data: uploadLink, error: linkError } = await supabase
      .from('upload_links')
      .select('session_id, reference_id, expires_at')
      .eq('token_hash', tokenHash)
      .limit(1)
      .single()

    if (linkError || !uploadLink) {
      return res.status(404).json({ error: 'Capture link not found or expired' })
    }

    // Check expiry
    if (new Date(uploadLink.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Capture link has expired' })
    }

    // Get the reference
    const { data: reference, error: refError } = await supabase
      .from('tenant_references_v2')
      .select('id, company_id, form_data')
      .eq('id', uploadLink.reference_id)
      .single()

    if (refError || !reference) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    // Upload file to Supabase storage
    const filePath = `v2-evidence/${reference.company_id}/${reference.id}/identity/${Date.now()}-${fileName}`
    const buffer = Buffer.from(fileData, 'base64')

    const { error: uploadError } = await supabase
      .storage
      .from('reference-documents')
      .upload(filePath, buffer, {
        contentType: fileType,
        upsert: false
      })

    if (uploadError) {
      console.error('[MobileCapture] Error uploading file:', uploadError)
      return res.status(500).json({ error: 'Failed to upload file' })
    }

    // Get the public URL
    const { data: urlData } = supabase
      .storage
      .from('reference-documents')
      .getPublicUrl(filePath)

    const publicUrl = urlData.publicUrl

    // Record in evidence_v2
    const { error: evidenceError } = await supabase
      .from('evidence_v2')
      .insert({
        reference_id: reference.id,
        section_type: 'IDENTITY',
        evidence_type: 'document',
        file_path: filePath,
        file_name: fileName,
        file_type: fileType,
        uploaded_by: 'tenant'
      })

    if (evidenceError) {
      console.error('[MobileCapture] Error recording evidence:', evidenceError)
    }

    // Update the matching upload_links row
    const { error: updateLinkError } = await supabase
      .from('upload_links')
      .update({
        uploaded_file_path: publicUrl,
        uploaded_at: new Date().toISOString()
      })
      .eq('session_id', uploadLink.session_id)
      .eq('field', type)

    if (updateLinkError) {
      console.error('[MobileCapture] Error updating upload link:', updateLinkError)
    }

    // Update form_data on the reference
    const formData = (reference.form_data as Record<string, any>) || {}
    const identity = (formData.identity as Record<string, any>) || {}

    if (type === 'id_photo') {
      identity.idDocumentUrl = publicUrl
    } else {
      identity.selfieUrl = publicUrl
    }

    formData.identity = identity

    const { error: formDataError } = await supabase
      .from('tenant_references_v2')
      .update({ form_data: formData })
      .eq('id', reference.id)

    if (formDataError) {
      console.error('[MobileCapture] Error updating form_data:', formDataError)
    }

    console.log('[MobileCapture] Uploaded', type, 'for reference:', reference.id)

    return res.json({
      success: true,
      url: publicUrl
    })
  } catch (error) {
    console.error('[MobileCapture] Error uploading file:', error)
    return res.status(500).json({ error: 'Failed to upload file' })
  }
})

export default router
