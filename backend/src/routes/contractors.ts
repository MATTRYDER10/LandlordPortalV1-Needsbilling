import { Router } from 'express'
import { authenticateToken, AuthRequest, getCompanyIdForRequest } from '../middleware/auth'
import * as contractorService from '../services/contractorService'
import { supabase } from '../config/supabase'
import { decrypt } from '../services/encryption'

const router = Router()

// GET /api/contractors — list all contractors for company
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) return res.status(400).json({ error: 'Company ID required' })

    const includeArchived = req.query.include_archived === 'true'
    const contractors = await contractorService.listContractors(companyId, includeArchived)
    res.json({ contractors })
  } catch (err: any) {
    console.error('Error listing contractors:', err)
    res.status(500).json({ error: 'Failed to list contractors' })
  }
})

// GET /api/contractors/:id — get single contractor
router.get('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) return res.status(400).json({ error: 'Company ID required' })

    const contractor = await contractorService.getContractor(req.params.id, companyId)
    if (!contractor) return res.status(404).json({ error: 'Contractor not found' })

    res.json({ contractor })
  } catch (err: any) {
    console.error('Error getting contractor:', err)
    res.status(500).json({ error: 'Failed to get contractor' })
  }
})

// GET /api/contractors/:id/invoices — list invoices for a contractor
router.get('/:id/invoices', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) return res.status(400).json({ error: 'Company ID required' })

    const { data: invoices, error } = await supabase
      .from('contractor_invoices')
      .select('id, invoice_number, invoice_date, gross_amount, commission_percent, commission_net, commission_vat_amount, payout_to_contractor, status, pdf_path, remittance_pdf_path, property_id')
      .eq('contractor_id', req.params.id)
      .eq('company_id', companyId)
      .order('invoice_date', { ascending: false })

    if (error) throw error

    // Enrich with property addresses
    const propertyIds = [...new Set((invoices || []).map(i => i.property_id).filter(Boolean))]
    let propertyMap = new Map<string, string>()
    if (propertyIds.length > 0) {
      const { data: properties } = await supabase
        .from('properties')
        .select('id, address_line1_encrypted, postcode')
        .in('id', propertyIds)
      for (const p of (properties || [])) {
        propertyMap.set(p.id, `${decrypt(p.address_line1_encrypted) || ''}, ${p.postcode || ''}`)
      }
    }

    const enriched = (invoices || []).map(inv => ({
      ...inv,
      gross_amount: parseFloat(inv.gross_amount),
      commission_net: parseFloat(inv.commission_net || 0),
      commission_vat_amount: parseFloat(inv.commission_vat_amount || 0),
      payout_amount: parseFloat(inv.payout_to_contractor || 0),
      property_address: inv.property_id ? propertyMap.get(inv.property_id) || '' : '',
    }))

    res.json(enriched)
  } catch (err: any) {
    console.error('Error fetching contractor invoices:', err)
    res.status(500).json({ error: 'Failed to fetch invoices' })
  }
})

// GET /api/contractors/invoice/:invoiceId/remittance — download remittance PDF
router.get('/invoice/:invoiceId/remittance', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) return res.status(400).json({ error: 'Company ID required' })

    const { data: invoice } = await supabase
      .from('contractor_invoices')
      .select('remittance_pdf_path')
      .eq('id', req.params.invoiceId)
      .eq('company_id', companyId)
      .single()

    if (!invoice?.remittance_pdf_path) return res.status(404).json({ error: 'Remittance not found' })

    const { data: signedUrl } = await supabase.storage
      .from('documents')
      .createSignedUrl(invoice.remittance_pdf_path, 60 * 60)

    if (signedUrl?.signedUrl) {
      res.json({ url: signedUrl.signedUrl })
    } else {
      res.status(404).json({ error: 'Could not generate download URL' })
    }
  } catch (err: any) {
    console.error('Error getting remittance PDF:', err)
    res.status(500).json({ error: 'Failed to get remittance' })
  }
})

// POST /api/contractors — create contractor
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) return res.status(400).json({ error: 'Company ID required' })

    const { name, company_name, email, phone, bank_account_name, bank_account_number, bank_sort_code, commission_percent, commission_vat, notes } = req.body

    if (!name) return res.status(400).json({ error: 'Name is required' })
    if (commission_percent === undefined) return res.status(400).json({ error: 'Commission percent is required' })

    const contractor = await contractorService.createContractor(companyId, {
      name, company_name, email, phone,
      bank_account_name, bank_account_number, bank_sort_code,
      commission_percent: parseFloat(commission_percent),
      commission_vat: commission_vat || false,
      notes
    })

    res.status(201).json({ contractor })
  } catch (err: any) {
    console.error('Error creating contractor:', err)
    res.status(500).json({ error: 'Failed to create contractor' })
  }
})

// PUT /api/contractors/:id — update contractor
router.put('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) return res.status(400).json({ error: 'Company ID required' })

    const contractor = await contractorService.updateContractor(req.params.id, companyId, req.body)
    res.json({ contractor })
  } catch (err: any) {
    console.error('Error updating contractor:', err)
    res.status(500).json({ error: 'Failed to update contractor' })
  }
})

// DELETE /api/contractors/:id — delete or archive contractor
router.delete('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) return res.status(400).json({ error: 'Company ID required' })

    const result = await contractorService.deleteContractor(req.params.id, companyId)
    if (result.archived) {
      res.json({ success: true, message: 'Contractor archived (has invoice history)', archived: true })
    } else {
      res.json({ success: true, message: 'Contractor deleted', deleted: true })
    }
  } catch (err: any) {
    console.error('Error deleting contractor:', err)
    res.status(500).json({ error: 'Failed to delete contractor' })
  }
})

// POST /api/contractors/:id/restore — restore archived contractor
router.post('/:id/restore', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) return res.status(400).json({ error: 'Company ID required' })

    await contractorService.restoreContractor(req.params.id, companyId)
    res.json({ success: true, message: 'Contractor restored' })
  } catch (err: any) {
    console.error('Error restoring contractor:', err)
    res.status(500).json({ error: 'Failed to restore contractor' })
  }
})

export default router
