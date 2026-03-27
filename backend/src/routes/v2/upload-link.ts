import express, { Request, Response, Router } from 'express'
import { supabase } from '../../config/supabase'
import { decrypt, hash } from '../../services/encryption'
import { logActivity } from '../../services/v2/activityServiceV2'
import { markSectionReady } from '../../services/v2/sectionServiceV2'

const router: Router = express.Router()

// GET /api/v2/upload-link/:token - Validate upload link and return info
router.get('/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params
    const tokenHash = hash(token)

    const { data: uploadLink, error } = await supabase
      .from('upload_links')
      .select('id, reference_id, section, field, document_name, expires_at')
      .eq('token_hash', tokenHash)
      .limit(1)
      .single()

    if (error || !uploadLink) {
      return res.status(404).json({ error: 'Upload link not found or expired' })
    }

    if (new Date(uploadLink.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Upload link has expired' })
    }

    // Get company name for branding
    const { data: reference } = await supabase
      .from('tenant_references_v2')
      .select('company_id')
      .eq('id', uploadLink.reference_id)
      .single()

    let companyName = 'PropertyGoose'
    if (reference) {
      const { data: company } = await supabase
        .from('companies')
        .select('name_encrypted')
        .eq('id', reference.company_id)
        .single()
      if (company?.name_encrypted) {
        companyName = decrypt(company.name_encrypted) || 'PropertyGoose'
      }
    }

    res.json({
      documentName: uploadLink.document_name || 'Document',
      section: uploadLink.section,
      field: uploadLink.field,
      companyName
    })
  } catch (error) {
    console.error('[UploadLink] Error validating token:', error)
    res.status(500).json({ error: 'Failed to validate upload link' })
  }
})

// POST /api/v2/upload-link/:token/upload - Upload file via link
router.post('/:token/upload', async (req: Request, res: Response) => {
  try {
    const { token } = req.params
    const { fileData, fileName, fileType } = req.body

    if (!fileData || !fileName || !fileType) {
      return res.status(400).json({ error: 'Missing required fields: fileData, fileName, fileType' })
    }

    const tokenHash = hash(token)

    const { data: uploadLink, error: linkError } = await supabase
      .from('upload_links')
      .select('id, reference_id, section, field, document_name, expires_at')
      .eq('token_hash', tokenHash)
      .limit(1)
      .single()

    if (linkError || !uploadLink) {
      return res.status(404).json({ error: 'Upload link not found or expired' })
    }

    if (new Date(uploadLink.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Upload link has expired' })
    }

    // Get reference for file path
    const { data: reference } = await supabase
      .from('tenant_references_v2')
      .select('company_id')
      .eq('id', uploadLink.reference_id)
      .single()

    if (!reference) {
      return res.status(404).json({ error: 'Reference not found' })
    }

    // Upload file
    const buffer = Buffer.from(fileData, 'base64')
    const filePath = `v2-evidence/${reference.company_id}/${uploadLink.reference_id}/${uploadLink.section}/${Date.now()}-${fileName}`

    const mimeMap: Record<string, string> = { '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.heic': 'image/heic', '.heif': 'image/heif' }
    const ext = '.' + (fileName || '').split('.').pop()?.toLowerCase()
    const resolvedType = (fileType && fileType !== 'application/octet-stream' && fileType !== '') ? fileType : mimeMap[ext] || 'application/pdf'

    const { error: uploadError } = await supabase
      .storage
      .from('reference-documents')
      .upload(filePath, buffer, { contentType: resolvedType, upsert: false })

    if (uploadError) {
      console.error('[UploadLink] Storage upload error:', uploadError.message)
      return res.status(500).json({ error: 'Failed to upload file' })
    }

    const { data: urlData } = supabase.storage.from('reference-documents').getPublicUrl(filePath)

    // Record evidence
    await supabase.from('evidence_v2').insert({
      reference_id: uploadLink.reference_id,
      section_type: (uploadLink.section || 'IDENTITY').toUpperCase(),
      evidence_type: 'document',
      file_path: filePath,
      file_name: fileName,
      file_type: fileType,
      uploaded_by: 'tenant'
    })

    // Mark upload link as used
    await supabase
      .from('upload_links')
      .update({ uploaded_file_path: urlData.publicUrl, uploaded_at: new Date().toISOString() })
      .eq('id', uploadLink.id)

    // Update form_data on the reference so the file appears in the drawer
    try {
      const { data: ref } = await supabase
        .from('tenant_references_v2')
        .select('form_data')
        .eq('id', uploadLink.reference_id)
        .single()

      if (ref) {
        const formData = ref.form_data || {}
        const section = uploadLink.section || 'identity'
        const field = uploadLink.field || 'documentUrl'

        // Map field names to form_data keys (append 'Url' suffix if not already present)
        const formDataField = field.endsWith('Url') ? field : field + 'Url'
        const willEmailField = field.endsWith('Url') ? field.replace('Url', 'WillEmail') : field + 'WillEmail'

        // Update the appropriate field in form_data
        if (!formData[section]) formData[section] = {}
        formData[section][formDataField] = urlData.publicUrl
        formData[section][willEmailField] = false // Clear the "will email" flag since they've now uploaded

        await supabase
          .from('tenant_references_v2')
          .update({ form_data: formData })
          .eq('id', uploadLink.reference_id)

        console.log('[UploadLink] Updated form_data field:', `${section}.${field}`)
      }
    } catch (formDataErr) {
      console.error('[UploadLink] Failed to update form_data (non-blocking):', formDataErr)
    }

    console.log('[UploadLink] File uploaded:', fileName, 'for reference:', uploadLink.reference_id)

    await logActivity({
      referenceId: uploadLink.reference_id,
      action: 'DOCUMENT_UPLOADED',
      performedBy: 'tenant',
      performedByType: 'tenant',
      notes: `${uploadLink.document_name || fileName} uploaded via email link`
    })

    // Evidence gate: auto-transition PENDING sections to READY when evidence arrives
    const uploadSectionType = (uploadLink.section || '').toUpperCase()
    if (['IDENTITY', 'ADDRESS', 'INCOME'].includes(uploadSectionType)) {
      try {
        const { data: pendingSection } = await supabase
          .from('reference_sections_v2')
          .select('id, section_data')
          .eq('reference_id', uploadLink.reference_id)
          .eq('section_type', uploadSectionType)
          .eq('queue_status', 'PENDING')
          .maybeSingle()

        if (pendingSection) {
          const evidenceStatus = (pendingSection.section_data as any)?.evidence_status
          if (evidenceStatus === 'AWAITING_UPLOAD' || evidenceStatus === 'AWAITING_EVIDENCE') {
            // Update section_data with evidence received, then mark ready
            await supabase
              .from('reference_sections_v2')
              .update({
                section_data: {
                  ...(pendingSection.section_data || {}),
                  evidence_status: 'EVIDENCE_RECEIVED'
                },
                updated_at: new Date().toISOString()
              })
              .eq('id', pendingSection.id)

            await markSectionReady(pendingSection.id, false)
            console.log(`[UploadLink] Evidence received - ${uploadSectionType} section marked READY`)
          }
        }
      } catch (sectionErr) {
        console.error('[UploadLink] Error checking section evidence gate:', sectionErr)
      }
    }

    res.json({ success: true, url: urlData.publicUrl })
  } catch (error) {
    console.error('[UploadLink] Error uploading:', error)
    res.status(500).json({ error: 'Failed to upload file' })
  }
})

export default router
