import { Router } from 'express'
import multer from 'multer'
import { authenticateToken, AuthRequest, getCompanyIdForRequest } from '../middleware/auth'
import * as rentgooseService from '../services/rentgooseService'

const router = Router()

const invoiceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true)
    else cb(new Error('Only PDF files allowed'))
  }
})

// GET /api/rentgoose/charges/:scheduleEntryId — get existing agent_charges for a schedule entry
router.get('/charges/:scheduleEntryId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) return res.status(400).json({ error: 'Company ID required' })

    const { supabase } = await import('../config/supabase')
    const { data, error } = await supabase
      .from('agent_charges')
      .select('*')
      .eq('schedule_entry_id', req.params.scheduleEntryId)
      .eq('company_id', companyId)

    if (error) throw error
    res.json(data || [])
  } catch (err: any) {
    console.error('Error fetching charges:', err)
    res.status(500).json({ error: 'Failed to fetch charges' })
  }
})

// POST /api/rentgoose/init-tenancy
router.post('/init-tenancy', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) return res.status(400).json({ error: 'Company ID required' })

    const { tenancy_id } = req.body
    if (!tenancy_id) return res.status(400).json({ error: 'tenancy_id required' })

    await rentgooseService.initTenancySchedule(tenancy_id, companyId)
    res.json({ success: true })
  } catch (err: any) {
    console.error('Error initialising tenancy schedule:', err)
    res.status(500).json({ error: 'Failed to initialise schedule' })
  }
})

// GET /api/rentgoose/schedule
router.get('/schedule', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) return res.status(400).json({ error: 'Company ID required' })

    const entries = await rentgooseService.getRentSchedule(companyId, {
      status: req.query.status as string,
      landlord_id: req.query.landlord_id as string,
      property_id: req.query.property_id as string,
      date_from: req.query.date_from as string,
      date_to: req.query.date_to as string,
    })

    // Compute summary stats
    const today = new Date().toISOString().split('T')[0]
    const collectedToday = entries
      .filter(e => e.status === 'paid' && e.due_date === today)
      .reduce((sum, e) => sum + e.amount_received, 0)
    const dueToday = entries
      .filter(e => e.due_date === today && e.status !== 'paid' && e.status !== 'cancelled')
      .reduce((sum, e) => sum + e.amount_due, 0)
    const overdueTotal = entries
      .filter(e => e.status === 'arrears' || e.status === 'overdue')
      .reduce((sum, e) => sum + (e.amount_due - e.amount_received), 0)
    const payoutsReady = entries
      .filter(e => e.status === 'paid')
      .reduce((sum, e) => sum + e.amount_received, 0)

    // Status counts
    const statusCounts = {
      all: entries.length,
      arrears: entries.filter(e => e.status === 'arrears').length,
      due: entries.filter(e => e.status === 'due').length,
      partial: entries.filter(e => e.status === 'partial').length,
      scheduled: entries.filter(e => e.status === 'scheduled').length,
      paid: entries.filter(e => e.status === 'paid').length,
    }

    res.json({
      entries,
      summary: { collectedToday, dueToday, overdueTotal, payoutsReady },
      statusCounts,
    })
  } catch (err: any) {
    console.error('Error getting rent schedule:', err)
    res.status(500).json({ error: 'Failed to get schedule' })
  }
})

// POST /api/rentgoose/receipt
router.post('/receipt', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) return res.status(400).json({ error: 'Company ID required' })

    const { schedule_entry_id, amount, payment_method, date_received, reference, tenant_id, charges, partial_action } = req.body

    if (!schedule_entry_id || !amount) {
      return res.status(400).json({ error: 'schedule_entry_id and amount required' })
    }

    const result = await rentgooseService.receiptPayment(companyId, {
      schedule_entry_id,
      amount: parseFloat(amount),
      payment_method: payment_method || 'bank_transfer',
      date_received: date_received || new Date().toISOString().split('T')[0],
      reference,
      created_by: req.user?.id,
      tenant_id,
      charges: charges || [],
      partial_action,
    })

    res.json(result)
  } catch (err: any) {
    console.error('Error receipting payment:', err)
    res.status(500).json({ error: 'Failed to receipt payment' })
  }
})

// GET /api/rentgoose/payouts
router.get('/payouts', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) return res.status(400).json({ error: 'Company ID required' })

    const payouts = await rentgooseService.getPayoutsQueue(companyId)
    res.json({ payouts })
  } catch (err: any) {
    console.error('Error getting payouts:', err)
    res.status(500).json({ error: 'Failed to get payouts' })
  }
})

// POST /api/rentgoose/payout
router.post('/payout', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) return res.status(400).json({ error: 'Company ID required' })

    const { schedule_entry_id, send_statement, log_statement, send_tenant_receipt } = req.body
    if (!schedule_entry_id) return res.status(400).json({ error: 'schedule_entry_id required' })

    const result = await rentgooseService.markPayoutPaid(companyId, {
      schedule_entry_id,
      paid_by: req.user?.id,
      send_statement: send_statement !== false,
      log_statement: log_statement !== false,
      send_tenant_receipt: send_tenant_receipt || false,
    })

    res.json(result)
  } catch (err: any) {
    console.error('Error processing payout:', err)
    res.status(500).json({ error: 'Failed to process payout' })
  }
})

// POST /api/rentgoose/payout/batch
router.post('/payout/batch', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) return res.status(400).json({ error: 'Company ID required' })

    const { schedule_entry_ids, send_statements, log_statements, send_tenant_receipts } = req.body
    if (!schedule_entry_ids || !Array.isArray(schedule_entry_ids)) {
      return res.status(400).json({ error: 'schedule_entry_ids array required' })
    }

    const result = await rentgooseService.batchPayout(companyId, {
      schedule_entry_ids,
      paid_by: req.user?.id,
      send_statements: send_statements !== false,
      log_statements: log_statements !== false,
      send_tenant_receipts: send_tenant_receipts || false,
    })

    res.json(result)
  } catch (err: any) {
    console.error('Error processing batch payout:', err)
    res.status(500).json({ error: 'Failed to process batch payout' })
  }
})

// GET /api/rentgoose/fees
router.get('/fees', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) return res.status(400).json({ error: 'Company ID required' })

    const fromDate = req.query.from as string | undefined
    const toDate = req.query.to as string | undefined
    const fees = await rentgooseService.getAgentFees(companyId, fromDate, toDate)
    res.json(fees)
  } catch (err: any) {
    console.error('Error getting agent fees:', err)
    res.status(500).json({ error: 'Failed to get fees' })
  }
})

// GET /api/rentgoose/arrears
router.get('/arrears', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) return res.status(400).json({ error: 'Company ID required' })

    const arrears = await rentgooseService.getArrears(companyId)
    res.json({ arrears })
  } catch (err: any) {
    console.error('Error getting arrears:', err)
    res.status(500).json({ error: 'Failed to get arrears' })
  }
})

// POST /api/rentgoose/arrears/resolve
router.post('/arrears/resolve', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) return res.status(400).json({ error: 'Company ID required' })

    const { id } = req.body
    if (!id) return res.status(400).json({ error: 'id required' })

    await rentgooseService.resolveArrears(id, companyId)
    res.json({ success: true })
  } catch (err: any) {
    console.error('Error resolving arrears:', err)
    res.status(500).json({ error: 'Failed to resolve arrears' })
  }
})

// GET /api/rentgoose/client-account
router.get('/client-account', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) return res.status(400).json({ error: 'Company ID required' })

    const result = await rentgooseService.getClientAccount(companyId, {
      entry_type: req.query.entry_type as string,
      date_from: req.query.date_from as string,
      date_to: req.query.date_to as string,
    })

    res.json(result)
  } catch (err: any) {
    console.error('Error getting client account:', err)
    res.status(500).json({ error: 'Failed to get client account' })
  }
})

// POST /api/rentgoose/client-account/manual
router.post('/client-account/manual', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) return res.status(400).json({ error: 'Company ID required' })

    const { entry_type, amount, description, reference } = req.body
    if (!entry_type || !amount || !description) {
      return res.status(400).json({ error: 'entry_type, amount, and description required' })
    }

    const entry = await rentgooseService.addManualEntry(companyId, {
      entry_type,
      amount: parseFloat(amount),
      description,
      reference,
      created_by: req.user?.id,
    })

    res.json({ entry })
  } catch (err: any) {
    console.error('Error adding manual entry:', err)
    res.status(500).json({ error: 'Failed to add manual entry' })
  }
})

// POST /api/rentgoose/client-account/reconcile
router.post('/client-account/reconcile', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) return res.status(400).json({ error: 'Company ID required' })

    const { bank_balance, date } = req.body
    if (bank_balance === undefined || !date) {
      return res.status(400).json({ error: 'bank_balance and date required' })
    }

    const result = await rentgooseService.recordReconciliation(companyId, {
      bank_balance: parseFloat(bank_balance),
      date,
      created_by: req.user?.id,
    })

    res.json(result)
  } catch (err: any) {
    console.error('Error recording reconciliation:', err)
    res.status(500).json({ error: 'Failed to record reconciliation' })
  }
})

// POST /api/rentgoose/contractor-invoice
router.post('/contractor-invoice', authenticateToken, invoiceUpload.single('invoice_pdf'), async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) return res.status(400).json({ error: 'Company ID required' })

    const { contractor_id, property_id, tenancy_id, invoice_number, invoice_date, gross_amount } = req.body
    if (!contractor_id || !invoice_number || !gross_amount) {
      return res.status(400).json({ error: 'contractor_id, invoice_number, and gross_amount required' })
    }

    // TODO: Upload PDF to storage if file provided
    let pdf_path: string | undefined
    if (req.file) {
      // Store PDF - for now save path placeholder
      pdf_path = `/storage/invoices/${companyId}/${invoice_number}.pdf`
    }

    const invoice = await rentgooseService.uploadContractorInvoice(companyId, {
      contractor_id,
      property_id,
      tenancy_id,
      invoice_number,
      invoice_date: invoice_date || new Date().toISOString().split('T')[0],
      gross_amount: parseFloat(gross_amount),
      uploaded_by: req.user?.id,
      pdf_path,
    })

    res.json({ invoice })
  } catch (err: any) {
    console.error('Error uploading contractor invoice:', err)
    res.status(500).json({ error: 'Failed to upload invoice' })
  }
})

// POST /api/rentgoose/contractor-payout
router.post('/contractor-payout', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) return res.status(400).json({ error: 'Company ID required' })

    const { invoice_id } = req.body
    if (!invoice_id) return res.status(400).json({ error: 'invoice_id required' })

    const result = await rentgooseService.markContractorPaid(companyId, {
      invoice_id,
      paid_by: req.user?.id,
    })

    res.json(result)
  } catch (err: any) {
    console.error('Error processing contractor payout:', err)
    res.status(500).json({ error: 'Failed to process contractor payout' })
  }
})

// POST /api/rentgoose/handle-notice
router.post('/handle-notice', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) return res.status(400).json({ error: 'Company ID required' })

    const { tenancy_id, vacate_date } = req.body
    if (!tenancy_id || !vacate_date) {
      return res.status(400).json({ error: 'tenancy_id and vacate_date required' })
    }

    await rentgooseService.handleNotice(tenancy_id, vacate_date, companyId)
    res.json({ success: true })
  } catch (err: any) {
    console.error('Error handling notice:', err)
    res.status(500).json({ error: 'Failed to handle notice' })
  }
})

// GET /api/rentgoose/landlord/:id/statements
router.get('/landlord/:id/statements', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) return res.status(400).json({ error: 'Company ID required' })

    const statements = await rentgooseService.getLandlordStatements(req.params.id, companyId)
    res.json({ statements })
  } catch (err: any) {
    console.error('Error getting landlord statements:', err)
    res.status(500).json({ error: 'Failed to get statements' })
  }
})

// GET /api/rentgoose/statement/:id/pdf
router.get('/statement/:id/pdf', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) return res.status(400).json({ error: 'Company ID required' })

    const { data: payout } = await (await import('../config/supabase')).supabase
      .from('payout_records')
      .select('statement_pdf_path')
      .eq('id', req.params.id)
      .eq('company_id', companyId)
      .single()

    if (!payout?.statement_pdf_path) {
      return res.status(404).json({ error: 'Statement not found' })
    }

    // For now return the path — PDF serving will use storage
    res.json({ pdf_path: payout.statement_pdf_path })
  } catch (err: any) {
    console.error('Error getting statement PDF:', err)
    res.status(500).json({ error: 'Failed to get statement' })
  }
})

// POST /api/rentgoose/undo-receipt — reverse a receipt, restoring the schedule entry to 'due'
router.post('/undo-receipt', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) return res.status(400).json({ error: 'Company ID required' })

    const { schedule_entry_id } = req.body
    if (!schedule_entry_id) return res.status(400).json({ error: 'schedule_entry_id required' })

    const { supabase } = await import('../config/supabase')

    // Verify the entry exists and belongs to this company
    const { data: entry } = await supabase
      .from('rent_schedule_entries')
      .select('id, status, amount_due')
      .eq('id', schedule_entry_id)
      .eq('company_id', companyId)
      .single()

    if (!entry) return res.status(404).json({ error: 'Schedule entry not found' })

    // Remove any landlord payout records for this entry
    const { data: landlordPayouts } = await supabase
      .from('payout_records')
      .select('id')
      .eq('schedule_entry_id', schedule_entry_id)
      .eq('payout_type', 'landlord')

    if (landlordPayouts && landlordPayouts.length > 0) {
      const payoutIds = landlordPayouts.map(p => p.id)
      await supabase.from('client_account_entries').delete().in('related_id', payoutIds)
      await supabase.from('payout_records').delete().in('id', payoutIds)
    }

    // Delete rent_payments for this entry
    const { data: payments } = await supabase
      .from('rent_payments')
      .select('id, client_account_entry_id')
      .eq('schedule_entry_id', schedule_entry_id)

    // Delete associated client account entries
    if (payments && payments.length > 0) {
      const clientEntryIds = payments.map(p => p.client_account_entry_id).filter(Boolean)
      if (clientEntryIds.length > 0) {
        await supabase.from('client_account_entries').delete().in('id', clientEntryIds)
      }
      await supabase.from('rent_payments').delete().eq('schedule_entry_id', schedule_entry_id)
    }

    // Get agent_charges for this entry before deleting (need contractor_invoice_ids)
    const { data: charges } = await supabase
      .from('agent_charges')
      .select('id, contractor_invoice_id, agent_paid_at')
      .eq('schedule_entry_id', schedule_entry_id)

    // Reverse any contractor invoices linked to these charges
    const contractorInvoiceIds = (charges || [])
      .map(c => c.contractor_invoice_id)
      .filter(Boolean)

    if (contractorInvoiceIds.length > 0) {
      // Delete contractor payout records and their client account entries
      const { data: contractorPayouts } = await supabase
        .from('payout_records')
        .select('id')
        .eq('company_id', companyId)
        .eq('payout_type', 'contractor')
        .eq('schedule_entry_id', schedule_entry_id)

      if (contractorPayouts && contractorPayouts.length > 0) {
        const payoutIds = contractorPayouts.map(p => p.id)
        await supabase.from('client_account_entries').delete().in('related_id', payoutIds)
        await supabase.from('payout_records').delete().in('id', payoutIds)
      }

      // Reset contractor invoices back to pending
      await supabase
        .from('contractor_invoices')
        .update({ status: 'pending', remittance_pdf_path: null, updated_at: new Date().toISOString() })
        .in('id', contractorInvoiceIds)
    }

    // Reverse any agent payouts that included these charges
    const paidChargeIds = (charges || []).filter(c => c.agent_paid_at).map(c => c.id)
    if (paidChargeIds.length > 0) {
      // Find agent payout records linked to this entry
      const { data: agentPayouts } = await supabase
        .from('payout_records')
        .select('id')
        .eq('company_id', companyId)
        .eq('payout_type', 'agent')
        .eq('schedule_entry_id', schedule_entry_id)

      if (agentPayouts && agentPayouts.length > 0) {
        const payoutIds = agentPayouts.map(p => p.id)
        await supabase.from('client_account_entries').delete().in('related_id', payoutIds)
        await supabase.from('payout_records').delete().in('id', payoutIds)
      }
    }

    // Delete agent_charges for this entry
    await supabase.from('agent_charges').delete().eq('schedule_entry_id', schedule_entry_id)

    // Delete any arrears_chases for this entry
    await supabase.from('arrears_chases').delete().eq('schedule_entry_id', schedule_entry_id)

    // Reset the schedule entry
    await supabase
      .from('rent_schedule_entries')
      .update({
        amount_received: 0,
        status: 'due',
        updated_at: new Date().toISOString()
      })
      .eq('id', schedule_entry_id)

    res.json({ success: true, message: 'Receipt undone' })
  } catch (err: any) {
    console.error('Error undoing receipt:', err)
    res.status(500).json({ error: 'Failed to undo receipt' })
  }
})

// POST /api/rentgoose/raise-charge — raise an ad-hoc invoice/charge against a property
router.post('/raise-charge', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) return res.status(400).json({ error: 'Company ID required' })

    const { property_id, description, amount, include_vat, is_credit, payee_type, contractor_id } = req.body

    if (!property_id) return res.status(400).json({ error: 'property_id required' })
    if (!description?.trim()) return res.status(400).json({ error: 'description required' })
    if (!amount || amount <= 0) return res.status(400).json({ error: 'amount must be positive' })

    const { supabase } = await import('../config/supabase')

    const netAmount = parseFloat(amount)
    const vatAmount = include_vat ? Math.round(netAmount * 20) / 100 : 0
    const grossAmount = netAmount + vatAmount

    // Find the NEXT unpaid schedule entry for this property (due/upcoming/overdue only)
    // Raised charges always apply to the next period, not the current receipted one
    const { data: entries } = await supabase
      .from('rent_schedule_entries')
      .select('id, tenancy_id, status')
      .eq('company_id', companyId)
      .in('status', ['due', 'upcoming', 'overdue'])
      .order('due_date', { ascending: true })

    let targetEntryId: string | null = null
    if (entries && entries.length > 0) {
      const tenancyIds = [...new Set(entries.map(e => e.tenancy_id))]
      const { data: tenancies } = await supabase
        .from('tenancies')
        .select('id')
        .eq('property_id', property_id)
        .in('id', tenancyIds)

      if (tenancies && tenancies.length > 0) {
        const tenancyIdSet = new Set(tenancies.map(t => t.id))
        const match = entries.find(e => tenancyIdSet.has(e.tenancy_id))
        if (match) targetEntryId = match.id
      }
    }

    // Build the charge record
    let contractorInvoiceId: string | null = null

    // If contractor payee, fetch their details and create an invoice
    if (payee_type === 'contractor' && contractor_id) {
      const { data: contractor } = await supabase
        .from('contractors')
        .select('id, commission_percent, commission_vat')
        .eq('id', contractor_id)
        .eq('company_id', companyId)
        .single()

      if (contractor) {
        const commPct = contractor.commission_percent || 0
        const commNet = Math.round(grossAmount * commPct) / 100
        const commVat = contractor.commission_vat ? Math.round(commNet * 20) / 100 : 0
        const payout = grossAmount - commNet - commVat

        const { data: invoice } = await supabase
          .from('contractor_invoices')
          .insert({
            company_id: companyId,
            contractor_id,
            property_id,
            invoice_date: new Date().toISOString().split('T')[0],
            gross_amount: grossAmount,
            commission_percent: commPct,
            commission_net: commNet,
            commission_vat: commVat,
            payout_amount: payout,
            status: 'pending'
          })
          .select('id')
          .single()

        if (invoice) contractorInvoiceId = invoice.id
      }
    }

    if (targetEntryId) {
      // Attach charge to the schedule entry
      const { data: charge, error } = await supabase
        .from('agent_charges')
        .insert({
          company_id: companyId,
          schedule_entry_id: targetEntryId,
          charge_type: 'ad_hoc',
          description: is_credit ? `[CREDIT] ${description.trim()}` : description.trim(),
          net_amount: netAmount,
          vat_amount: vatAmount,
          gross_amount: grossAmount,
          included: true,
          contractor_invoice_id: contractorInvoiceId
        })
        .select()
        .single()

      if (error) throw error
      res.status(201).json({ charge, status: 'attached', schedule_entry_id: targetEntryId })
    } else {
      // No active schedule entry — store as pending charge on property_charges
      const { data: pendingCharge, error } = await supabase
        .from('property_charges')
        .insert({
          property_id,
          company_id: companyId,
          description: is_credit ? `[PENDING CREDIT] ${description.trim()}` : `[PENDING AD-HOC] ${description.trim()}`,
          amount: grossAmount,
          charge_type: 'one_off',
          is_vatable: include_vat || false
        })
        .select()
        .single()

      if (error) throw error
      res.status(201).json({ charge: pendingCharge, status: 'pending', message: 'No active schedule entry — charge stored as pending' })
    }
  } catch (err: any) {
    console.error('Error raising charge:', err)
    res.status(500).json({ error: 'Failed to raise charge' })
  }
})

// GET /api/rentgoose/pending-contractor-payouts — contractor invoices ready for payment
router.get('/pending-contractor-payouts', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) return res.status(400).json({ error: 'Company ID required' })

    const { supabase } = await import('../config/supabase')
    const { decrypt } = await import('../services/encryption')

    const { data: invoices, error } = await supabase
      .from('contractor_invoices')
      .select('id, contractor_id, property_id, invoice_number, invoice_date, gross_amount, commission_percent, commission_net, commission_vat_amount, payout_to_contractor, status')
      .eq('company_id', companyId)
      .in('status', ['pending', 'charged'])
      .order('invoice_date', { ascending: false })

    if (error) throw error
    if (!invoices || invoices.length === 0) return res.json([])

    const contractorIds = [...new Set(invoices.map(i => i.contractor_id))]
    const { data: contractors } = await supabase
      .from('contractors')
      .select('id, name')
      .in('id', contractorIds)
    const contractorMap = new Map((contractors || []).map(c => [c.id, c.name]))

    const propertyIds = [...new Set(invoices.map(i => i.property_id).filter(Boolean))]
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

    const enriched = invoices.map(inv => ({
      id: inv.id,
      contractor_name: contractorMap.get(inv.contractor_id) || 'Unknown',
      property_address: inv.property_id ? propertyMap.get(inv.property_id) || '' : '',
      invoice_number: inv.invoice_number,
      invoice_date: inv.invoice_date,
      gross_amount: parseFloat(inv.gross_amount),
      commission_percent: parseFloat(inv.commission_percent || 0),
      commission_net: parseFloat(inv.commission_net || 0),
      commission_vat_amount: parseFloat(inv.commission_vat_amount || 0),
      payout_amount: parseFloat(inv.payout_to_contractor || inv.gross_amount),
      status: inv.status,
    }))

    res.json(enriched)
  } catch (err: any) {
    console.error('Error fetching pending contractor payouts:', err)
    res.status(500).json({ error: 'Failed to fetch contractor payouts' })
  }
})

// GET /api/rentgoose/pending-agent-charges — agent charges ready for payout (after landlord paid)
router.get('/pending-agent-charges', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) return res.status(400).json({ error: 'Company ID required' })

    const { supabase } = await import('../config/supabase')

    const { data: charges } = await supabase
      .from('agent_charges')
      .select('id, schedule_entry_id, charge_type, description, net_amount, vat_amount, gross_amount, included, agent_paid_at')
      .eq('company_id', companyId)
      .eq('included', true)
      .is('agent_paid_at', null)
      .order('created_at', { ascending: false })

    if (!charges || charges.length === 0) return res.json([])

    // Only show charges where the landlord payout has been completed
    const entryIds = [...new Set(charges.map(c => c.schedule_entry_id))]
    const { data: landlordPayouts } = await supabase
      .from('payout_records')
      .select('schedule_entry_id')
      .eq('company_id', companyId)
      .eq('payout_type', 'landlord')
      .in('schedule_entry_id', entryIds)

    const paidOutEntryIds = new Set((landlordPayouts || []).map(p => p.schedule_entry_id))
    const readyCharges = charges.filter(c => paidOutEntryIds.has(c.schedule_entry_id))

    res.json(readyCharges.map(c => ({
      ...c,
      net_amount: parseFloat(c.net_amount),
      vat_amount: parseFloat(c.vat_amount),
      gross_amount: parseFloat(c.gross_amount),
    })))
  } catch (err: any) {
    console.error('Error fetching pending agent charges:', err)
    res.status(500).json({ error: 'Failed to fetch agent charges' })
  }
})

export default router
