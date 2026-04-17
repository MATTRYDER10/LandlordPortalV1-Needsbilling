import { Router } from 'express'
import multer from 'multer'
import { authenticateToken, AuthRequest, getCompanyIdForRequest } from '../middleware/auth'
import * as rentgooseService from '../services/rentgooseService'
import { isRentGooseEnabled } from '../services/rentgooseAccess'
import { decrypt } from '../services/encryption'

const router = Router()

// Gate ALL RentGoose routes — companies not on the whitelist get a clean 403,
// preventing any background processing for non-RentGoose users.
router.use(authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) return res.status(400).json({ error: 'Company ID required' })
    const enabled = await isRentGooseEnabled(companyId)
    if (!enabled) return res.status(403).json({ error: 'RentGoose is not enabled for this company' })
    next()
  } catch (err: any) {
    console.error('[RentGoose] Access check failed:', err)
    res.status(500).json({ error: 'Failed to verify RentGoose access' })
  }
})

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

// POST /api/rentgoose/chase-email — send arrears chase email to tenants
router.post('/chase-email', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) return res.status(400).json({ error: 'Company ID required' })

    const { schedule_entry_id } = req.body
    if (!schedule_entry_id) return res.status(400).json({ error: 'schedule_entry_id required' })

    const { supabase } = await import('../config/supabase')
    const { decrypt } = await import('../services/encryption')
    const { sendEmail, loadEmailTemplate } = await import('../services/emailService')

    // Get schedule entry
    const { data: entry } = await supabase
      .from('rent_schedule_entries')
      .select('tenancy_id, amount_due, amount_received, due_date, period_start, period_end, status')
      .eq('id', schedule_entry_id)
      .eq('company_id', companyId)
      .single()

    if (!entry) return res.status(404).json({ error: 'Schedule entry not found' })
    if (entry.status !== 'arrears' && entry.status !== 'overdue') {
      return res.status(400).json({ error: 'Entry is not in arrears' })
    }

    // Get tenancy + property
    const { data: tenancy } = await supabase
      .from('tenancies')
      .select('property_id')
      .eq('id', entry.tenancy_id)
      .single()

    if (!tenancy) return res.status(404).json({ error: 'Tenancy not found' })

    // Get property address (first line = payment reference)
    const { data: property } = await supabase
      .from('properties')
      .select('address_line1_encrypted, postcode')
      .eq('id', tenancy.property_id)
      .single()

    const propertyLine1 = property ? (decrypt(property.address_line1_encrypted) || '') : ''
    const propertyFull = property ? `${propertyLine1}, ${property.postcode || ''}`.trim().replace(/,\s*$/, '') : ''

    // Get active tenants
    const { data: tenants } = await supabase
      .from('tenancy_tenants')
      .select('first_name_encrypted, last_name_encrypted, email_encrypted')
      .eq('tenancy_id', entry.tenancy_id)
      .eq('status', 'active')

    if (!tenants || tenants.length === 0) return res.status(400).json({ error: 'No active tenants found' })

    // Get company settings
    const { data: company } = await supabase
      .from('companies')
      .select('name_encrypted, email_encrypted, phone_encrypted, logo_url, primary_color, bank_account_name, bank_account_number, bank_sort_code')
      .eq('id', companyId)
      .single()

    const companyName = company ? (decrypt(company.name_encrypted) || 'Your Letting Agent') : 'Your Letting Agent'
    const companyEmail = company ? (decrypt(company.email_encrypted) || '') : ''
    const companyPhone = company ? (decrypt(company.phone_encrypted) || '') : ''
    const logoUrl = company?.logo_url || 'https://app.propertygoose.co.uk/PropertyGooseLogo.png'
    const brandColor = company?.primary_color || '#f97316'
    const bankAccountName = company?.bank_account_name || 'Not provided'
    const bankAccountNumber = company?.bank_account_number || 'Not provided'
    const bankSortCode = company?.bank_sort_code || 'Not provided'

    // Format dates UK style
    const fmtDate = (d: string) => {
      const dt = new Date(d)
      return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
    }

    const amountOutstanding = (entry.amount_due - entry.amount_received).toFixed(2)

    // Send to each tenant
    const tenantNames = tenants.map(t => `${decrypt(t.first_name_encrypted) || ''} ${decrypt(t.last_name_encrypted) || ''}`.trim())

    for (const tenant of tenants) {
      const tenantEmail = decrypt(tenant.email_encrypted)
      if (!tenantEmail) continue

      const tenantName = `${decrypt(tenant.first_name_encrypted) || ''} ${decrypt(tenant.last_name_encrypted) || ''}`.trim()
      const salutation = tenants.length > 1 ? tenantNames.join(' & ') : tenantName

      const html = loadEmailTemplate('rent-arrears-chase', {
        CompanyName: companyName,
        AgentLogoUrl: logoUrl,
        TenantName: salutation,
        PropertyAddress: propertyFull,
        Amount: parseFloat(amountOutstanding).toLocaleString('en-GB', { minimumFractionDigits: 2 }),
        DueDate: fmtDate(entry.due_date),
        PeriodStart: fmtDate(entry.period_start),
        PeriodEnd: fmtDate(entry.period_end),
        PaymentReference: propertyLine1 || propertyFull,
        BankAccountName: bankAccountName,
        BankAccountNumber: bankAccountNumber,
        BankSortCode: bankSortCode,
        CompanyEmail: companyEmail,
        CompanyPhone: companyPhone,
        BrandColor: brandColor,
      })

      await sendEmail({
        to: tenantEmail,
        subject: `${companyName} - Rent Overdue Notice — ${propertyFull}`,
        html,
        companyId,
        emailCategory: 'arrears_chase',
      })
    }

    res.json({ success: true, sent_to: tenants.length })
  } catch (err: any) {
    console.error('Error sending chase email:', err)
    res.status(500).json({ error: 'Failed to send chase email' })
  }
})

// POST /api/rentgoose/sync-tenancies — ensure all active managed tenancies have schedule entries
router.post('/sync-tenancies', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) return res.status(400).json({ error: 'Company ID required' })

    const result = await rentgooseService.syncActiveManagedTenancies(companyId)
    res.json({ success: true, ...result })
  } catch (err: any) {
    console.error('Error syncing tenancies:', err)
    res.status(500).json({ error: 'Failed to sync tenancies' })
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
    // Collected today: entries that were receipted/paid today (regardless of due date)
    const collectedToday = entries
      .filter(e => e.status === 'paid' && (e.paid_at || '').startsWith(today))
      .reduce((sum, e) => sum + e.amount_received, 0)
    // Due today: entries with due_date = today that haven't been paid
    const dueToday = entries
      .filter(e => e.due_date === today && e.status !== 'paid' && e.status !== 'cancelled')
      .reduce((sum, e) => sum + e.amount_due, 0)
    // Arrears: overdue entries (due date in past, not paid)
    const overdueTotal = entries
      .filter(e => (e.status === 'arrears' || e.status === 'overdue') && e.due_date < today)
      .reduce((sum, e) => sum + (e.amount_due - e.amount_received), 0)
    // Payouts ready: paid entries where payout hasn't been sent to landlord yet
    const payoutsReady = entries
      .filter(e => e.status === 'paid' && !e.payout_sent_at)
      .reduce((sum, e) => sum + (e.amount_received - (e.total_charges || 0)), 0)

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

    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number' })
    }

    const result = await rentgooseService.receiptPayment(companyId, {
      schedule_entry_id,
      amount: parsedAmount,
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

    const { schedule_entry_id, landlord_id, send_statement, log_statement, send_tenant_receipt } = req.body
    if (!schedule_entry_id) return res.status(400).json({ error: 'schedule_entry_id required' })

    const result = await rentgooseService.markPayoutPaid(companyId, {
      schedule_entry_id,
      landlord_id: landlord_id || undefined,
      paid_by: req.user?.id,
      send_statement: send_statement !== false,
      log_statement: log_statement !== false,
      send_tenant_receipt: send_tenant_receipt || false,
    })

    res.json(result)
  } catch (err: any) {
    console.error('Error processing payout:', err)
    res.status(500).json({ error: 'Failed to process payout', details: err.message || String(err) })
  }
})

// POST /api/rentgoose/hold-payout — move a payout into held monies
router.post('/hold-payout', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) return res.status(400).json({ error: 'Company ID required' })

    const { schedule_entry_id, landlord_id } = req.body
    if (!schedule_entry_id) return res.status(400).json({ error: 'schedule_entry_id required' })

    const result = await rentgooseService.holdPayout(companyId, {
      schedule_entry_id,
      landlord_id: landlord_id || undefined,
      held_by: req.user?.id,
    })

    res.json(result)
  } catch (err: any) {
    console.error('Error holding payout:', err)
    res.status(500).json({ error: 'Failed to hold payout' })
  }
})

// GET /api/rentgoose/held-rents — get all held rent payouts
router.get('/held-rents', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) return res.status(400).json({ error: 'Company ID required' })

    const result = await rentgooseService.getHeldRents(companyId)
    res.json({ heldRents: result })
  } catch (err: any) {
    console.error('Error fetching held rents:', err)
    res.status(500).json({ error: 'Failed to fetch held rents' })
  }
})

// POST /api/rentgoose/release-held — release held rent back into payout flow
router.post('/release-held', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) return res.status(400).json({ error: 'Company ID required' })

    const { payout_record_id } = req.body
    if (!payout_record_id) return res.status(400).json({ error: 'payout_record_id required' })

    const result = await rentgooseService.releaseHeldRent(companyId, {
      payout_record_id,
      released_by: req.user?.id,
    })

    res.json(result)
  } catch (err: any) {
    console.error('Error releasing held rent:', err)
    res.status(500).json({ error: 'Failed to release held rent' })
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

// POST /api/rentgoose/arrears/silence — Silence arrears emails for 30 days
router.post('/arrears/silence', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) return res.status(400).json({ error: 'Company ID required' })

    const { schedule_entry_id } = req.body
    if (!schedule_entry_id) return res.status(400).json({ error: 'schedule_entry_id required' })

    const silencedUntil = new Date()
    silencedUntil.setDate(silencedUntil.getDate() + 30)

    const { supabase } = await import('../config/supabase')

    // Try to find an existing active chase for this schedule entry and update it.
    // If none exists (e.g. the schedule entry is in arrears but the arrears-chase
    // scheduler hasn't created a chase row for it yet), create a silenced row so
    // the silence persists across refreshes.
    const { data: existing, error: findErr } = await supabase
      .from('arrears_chases')
      .select('id')
      .eq('schedule_entry_id', schedule_entry_id)
      .eq('status', 'active')
      .maybeSingle()

    if (findErr) throw findErr

    if (existing) {
      const { error: updateErr } = await supabase
        .from('arrears_chases')
        .update({ silenced_until: silencedUntil.toISOString() })
        .eq('id', existing.id)
      if (updateErr) throw updateErr
    } else {
      // Look up the schedule entry so we can populate the new chase row
      const { data: entry, error: entryErr } = await supabase
        .from('rent_schedule_entries')
        .select('id, company_id, amount_due, amount_received')
        .eq('id', schedule_entry_id)
        .eq('company_id', companyId)
        .single()

      if (entryErr || !entry) {
        return res.status(404).json({ error: 'Schedule entry not found' })
      }

      const outstanding = Number(entry.amount_due || 0) - Number(entry.amount_received || 0)

      const { error: insertErr } = await supabase
        .from('arrears_chases')
        .insert({
          company_id: entry.company_id,
          schedule_entry_id: entry.id,
          amount_outstanding: outstanding > 0 ? outstanding : 0,
          status: 'active',
          silenced_until: silencedUntil.toISOString()
        })
      if (insertErr) throw insertErr
    }

    res.json({ success: true, silenced_until: silencedUntil.toISOString() })
  } catch (err: any) {
    console.error('Error silencing arrears:', err)
    res.status(500).json({ error: 'Failed to silence arrears' })
  }
})

// POST /api/rentgoose/schedule/remove — Remove a schedule entry (cancel + resolve arrears)
router.post('/schedule/remove', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) return res.status(400).json({ error: 'Company ID required' })

    const { schedule_entry_id } = req.body
    if (!schedule_entry_id) return res.status(400).json({ error: 'schedule_entry_id required' })

    // Cancel the schedule entry
    const { supabase } = await import('../config/supabase')
    const { error: entryError } = await supabase
      .from('rent_schedule_entries')
      .update({ status: 'cancelled' })
      .eq('id', schedule_entry_id)
      .eq('company_id', companyId)

    if (entryError) throw entryError

    // Resolve any associated arrears chase
    const { data: chase } = await supabase
      .from('arrears_chases')
      .select('id')
      .eq('schedule_entry_id', schedule_entry_id)
      .eq('status', 'active')
      .single()

    if (chase) {
      await supabase
        .from('arrears_chases')
        .update({ status: 'resolved', resolved_at: new Date().toISOString() })
        .eq('id', chase.id)
    }

    res.json({ success: true })
  } catch (err: any) {
    console.error('Error removing schedule entry:', err)
    res.status(500).json({ error: 'Failed to remove from list' })
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

// GET /api/rentgoose/deposits — list every collected deposit for the company
// with its scheme, registration status and current location (held by agent /
// registered with scheme / paid to landlord). Used by the Deposits tab on the
// PayoutsBoard so the agent can SEE every deposit, not just the ones bundled
// invisibly into a rent payout.
router.get('/deposits', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) return res.status(400).json({ error: 'Company ID required' })

    const deposits = await rentgooseService.getDepositsList(companyId)
    res.json({ deposits })
  } catch (err: any) {
    console.error('Error fetching deposits:', err)
    res.status(500).json({ error: 'Failed to fetch deposits' })
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

// POST /api/rentgoose/rent-credit — apply a rent credit to a schedule entry
router.post('/rent-credit', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) return res.status(400).json({ error: 'Company ID required' })

    const { schedule_entry_id, credit_amount, reason } = req.body
    if (!schedule_entry_id || !credit_amount || !reason) {
      return res.status(400).json({ error: 'schedule_entry_id, credit_amount, and reason required' })
    }

    const result = await rentgooseService.applyRentCredit(companyId, {
      schedule_entry_id,
      credit_amount: parseFloat(credit_amount),
      reason,
      applied_by: req.user?.id,
    })

    res.json(result)
  } catch (err: any) {
    console.error('Error applying rent credit:', err)
    res.status(500).json({ error: 'Failed to apply rent credit' })
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

    // Generate signed URL for download
    const { supabase } = await import('../config/supabase')
    const { data: signedData, error: signError } = await supabase.storage
      .from('documents')
      .createSignedUrl(payout.statement_pdf_path, 300) // 5 min expiry

    if (signError || !signedData?.signedUrl) {
      console.error('Failed to create signed URL:', signError)
      return res.status(500).json({ error: 'Failed to generate download link' })
    }

    res.json({ pdf_url: signedData.signedUrl, pdf_path: payout.statement_pdf_path })
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

    // Resolve property_address for each charge via schedule_entry → tenancy → property.
    // Doing this server-side (instead of letting the frontend cross-ref the landlord-payout
    // queue) ensures charges whose landlord payout has already completed still show the
    // correct property instead of falling back to "Unknown property".
    const entryIds = [...new Set(charges.map(c => c.schedule_entry_id).filter(Boolean))]
    const { data: entries } = entryIds.length > 0
      ? await supabase.from('rent_schedule_entries').select('id, tenancy_id').in('id', entryIds)
      : { data: [] }
    const entryToTenancy = new Map((entries || []).map(e => [e.id, e.tenancy_id]))

    const tenancyIds = [...new Set((entries || []).map(e => e.tenancy_id).filter(Boolean))]
    const { data: tenancies } = tenancyIds.length > 0
      ? await supabase.from('tenancies').select('id, property_id').in('id', tenancyIds)
      : { data: [] }
    const tenancyToProp = new Map((tenancies || []).map(t => [t.id, t.property_id]))

    const propertyIds = [...new Set((tenancies || []).map(t => t.property_id).filter(Boolean))]
    const { data: properties } = propertyIds.length > 0
      ? await supabase.from('properties').select('id, address_line1_encrypted, postcode').in('id', propertyIds)
      : { data: [] }
    const propMap = new Map((properties || []).map(p => [p.id, {
      id: p.id,
      address: `${decrypt(p.address_line1_encrypted) || ''}, ${p.postcode || ''}`.replace(/^, |, $/g, ''),
    }]))

    res.json(charges.map(c => {
      const tenancyId = entryToTenancy.get(c.schedule_entry_id)
      const propertyId = tenancyId ? tenancyToProp.get(tenancyId) : null
      const prop = propertyId ? propMap.get(propertyId) : null
      return {
        ...c,
        net_amount: parseFloat(c.net_amount),
        vat_amount: parseFloat(c.vat_amount),
        gross_amount: parseFloat(c.gross_amount),
        property_address: prop?.address || 'Unknown property',
        property_id: prop?.id || null,
      }
    }))
  } catch (err: any) {
    console.error('Error fetching pending agent charges:', err)
    res.status(500).json({ error: 'Failed to fetch agent charges' })
  }
})

// POST /api/rentgoose/agent-payout — process pending agent charges into a payout
router.post('/agent-payout', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) return res.status(400).json({ error: 'Company ID required' })

    const { charge_ids } = req.body || {}

    const result = await rentgooseService.processAgentPayout(companyId, {
      charge_ids: Array.isArray(charge_ids) && charge_ids.length > 0 ? charge_ids : undefined,
      paid_by: req.user?.id,
    })

    res.json(result)
  } catch (err: any) {
    console.error('Error processing agent payout:', err)
    res.status(500).json({ error: err.message || 'Failed to process agent payout' })
  }
})

// GET /api/rentgoose/agent-payouts — history of agent payouts
router.get('/agent-payouts', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) return res.status(400).json({ error: 'Company ID required' })

    const history = await rentgooseService.getAgentPayoutHistory(companyId)
    res.json({ payouts: history })
  } catch (err: any) {
    console.error('Error fetching agent payout history:', err)
    res.status(500).json({ error: 'Failed to fetch agent payout history' })
  }
})

// GET /api/rentgoose/agent-payout/:id — details of a single agent payout
router.get('/agent-payout/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) return res.status(400).json({ error: 'Company ID required' })

    const details = await rentgooseService.getAgentPayoutDetails(companyId, req.params.id)
    if (!details) return res.status(404).json({ error: 'Agent payout not found' })

    res.json(details)
  } catch (err: any) {
    console.error('Error fetching agent payout details:', err)
    res.status(500).json({ error: 'Failed to fetch agent payout details' })
  }
})

// POST /api/rentgoose/init-all-active — one-off: init rent schedules for all active tenancies
router.post('/init-all-active', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) return res.status(400).json({ error: 'Company ID required' })

    const { supabase } = await import('../config/supabase')

    // Get all active managed tenancies for this company (exclude let-only)
    const { data: tenancies, error } = await supabase
      .from('tenancies')
      .select('id, status, property_id')
      .eq('company_id', companyId)
      .in('status', ['active', 'notice_given'])
      .is('deleted_at', null)

    if (error) throw error

    // Filter to only properties with fee information
    const propertyIds = [...new Set((tenancies || []).map(t => t.property_id).filter(Boolean))]
    let propsWithFees = new Set<string>()
    if (propertyIds.length > 0) {
      const { data: props } = await supabase
        .from('properties')
        .select('id, fee_percent, management_fee_type')
        .in('id', propertyIds)
      for (const p of (props || [])) {
        const hasFee = (p.fee_percent && parseFloat(p.fee_percent) > 0) || p.management_fee_type === 'fixed'
        if (hasFee) propsWithFees.add(p.id)
      }
    }

    const eligibleTenancies = (tenancies || []).filter(t => !t.property_id || propsWithFees.has(t.property_id))

    if (eligibleTenancies.length === 0) {
      return res.json({ message: 'No active tenancies with fee information found', count: 0 })
    }

    let successCount = 0
    const errors: string[] = []

    for (const tenancy of eligibleTenancies) {
      try {
        await rentgooseService.initTenancySchedule(tenancy.id, companyId)
        successCount++
      } catch (err: any) {
        errors.push(`${tenancy.id}: ${err.message}`)
      }
    }

    res.json({
      message: `Initialised ${successCount} of ${eligibleTenancies.length} tenancies with fees (${(tenancies || []).length - eligibleTenancies.length} without fees excluded)`,
      count: successCount,
      total: eligibleTenancies.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (err: any) {
    console.error('Error initialising all tenancies:', err)
    res.status(500).json({ error: 'Failed to initialise tenancies' })
  }
})

// ============================================================================
// UNIFIED PAYMENTS / EXPECTED PAYMENTS
// ============================================================================

// GET /api/rentgoose/unified-schedule
router.get('/unified-schedule', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) return res.status(400).json({ error: 'Company ID required' })

    const result = await rentgooseService.getUnifiedSchedule(companyId, {
      status: req.query.status as string,
      payment_type: req.query.payment_type as string,
      category: req.query.category as string,
      date_from: req.query.date_from as string,
      date_to: req.query.date_to as string,
    })

    res.json(result)
  } catch (err: any) {
    console.error('Error getting unified schedule:', err)
    res.status(500).json({ error: 'Failed to get unified schedule' })
  }
})

// POST /api/rentgoose/receipt-expected
router.post('/receipt-expected', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) return res.status(400).json({ error: 'Company ID required' })

    const { expected_payment_id, amount, payment_method, payment_reference, date_received, holding_deposit_credit_amount, holding_deposit_credit_id } = req.body
    if (!expected_payment_id || !amount) {
      return res.status(400).json({ error: 'expected_payment_id and amount required' })
    }

    const result = await rentgooseService.receiptExpectedPayment(companyId, {
      expected_payment_id,
      amount: parseFloat(amount),
      payment_method,
      payment_reference,
      date_received,
      receipted_by: req.user?.id,
      holding_deposit_credit_amount: holding_deposit_credit_amount ? parseFloat(holding_deposit_credit_amount) : undefined,
      holding_deposit_credit_id,
    })

    res.json(result)
  } catch (err: any) {
    console.error('Error receipting expected payment:', err)
    res.status(500).json({ error: 'Failed to receipt expected payment' })
  }
})

// GET /api/rentgoose/holding-deposit-credit/:tenancyId
router.get('/holding-deposit-credit/:tenancyId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) return res.status(400).json({ error: 'Company ID required' })

    const result = await rentgooseService.getHoldingDepositCredit(companyId, req.params.tenancyId)
    res.json(result)
  } catch (err: any) {
    console.error('Error getting holding deposit credit:', err)
    res.status(500).json({ error: 'Failed to get holding deposit credit' })
  }
})

// POST /api/rentgoose/deposit-protected
router.post('/deposit-protected', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) return res.status(400).json({ error: 'Company ID required' })

    const { expected_payment_id, dan_reference, scheme, protected_date } = req.body
    if (!expected_payment_id || !dan_reference || !scheme) {
      return res.status(400).json({ error: 'expected_payment_id, dan_reference, and scheme required' })
    }

    const result = await rentgooseService.markDepositProtected(companyId, {
      expected_payment_id,
      dan_reference,
      scheme,
      protected_date: protected_date || new Date().toISOString().split('T')[0],
      receipted_by: req.user?.id,
    })

    res.json({ entry: result })
  } catch (err: any) {
    console.error('Error marking deposit protected:', err)
    res.status(500).json({ error: 'Failed to mark deposit protected' })
  }
})

// GET /api/rentgoose/landlords — landlords with active tenancies OR payout history (retained even if off management)
router.get('/landlords', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) return res.status(400).json({ error: 'Company ID required' })

    const { supabase } = await import('../config/supabase')
    const { decrypt } = await import('../services/encryption')

    // --- Source 1: Landlords with active tenancies ---
    const { data: tenancies } = await supabase
      .from('tenancies')
      .select('id, property_id, status')
      .eq('company_id', companyId)
      .in('status', ['active', 'notice_given'])
      .is('deleted_at', null)

    const propertyIds = [...new Set((tenancies || []).map(t => t.property_id).filter(Boolean))]

    const { data: propLandlords } = propertyIds.length > 0
      ? await supabase
          .from('property_landlords')
          .select('property_id, landlord_id')
          .in('property_id', propertyIds)
      : { data: [] }

    const activeLandlordIds = new Set((propLandlords || []).map(pl => pl.landlord_id))

    // --- Source 2: Landlords with ANY payout history (retained even if property off management) ---
    const { data: payoutSums } = await supabase
      .from('payout_records')
      .select('landlord_id, net_payout')
      .eq('company_id', companyId)
      .eq('payout_type', 'landlord')

    const payoutTotals = new Map<string, number>()
    for (const p of (payoutSums || [])) {
      if (!p.landlord_id) continue
      payoutTotals.set(p.landlord_id, (payoutTotals.get(p.landlord_id) || 0) + parseFloat(p.net_payout))
    }

    // Merge both sets — active tenancy landlords + anyone with payout history
    const allLandlordIds = [...new Set([...activeLandlordIds, ...payoutTotals.keys()])]
    if (allLandlordIds.length === 0) return res.json({ landlords: [] })

    // Get landlord details
    const { data: landlords } = await supabase
      .from('landlords')
      .select('id, first_name_encrypted, last_name_encrypted, email_encrypted')
      .in('id', allLandlordIds)

    // Count active properties per landlord
    const propsByLandlord = new Map<string, Set<string>>()
    for (const pl of (propLandlords || [])) {
      if (!propsByLandlord.has(pl.landlord_id)) propsByLandlord.set(pl.landlord_id, new Set())
      propsByLandlord.get(pl.landlord_id)!.add(pl.property_id)
    }

    // Get property addresses for active properties
    const { data: allProperties } = propertyIds.length > 0
      ? await supabase
          .from('properties')
          .select('id, address_line1_encrypted, postcode')
          .in('id', propertyIds)
      : { data: [] }

    const propertyAddrMap = new Map<string, string>()
    for (const p of (allProperties || [])) {
      propertyAddrMap.set(p.id, `${decrypt(p.address_line1_encrypted) || ''}, ${p.postcode || ''}`)
    }

    const landlordPropertyAddresses = new Map<string, string[]>()
    for (const pl of (propLandlords || [])) {
      if (!landlordPropertyAddresses.has(pl.landlord_id)) landlordPropertyAddresses.set(pl.landlord_id, [])
      const addr = propertyAddrMap.get(pl.property_id)
      if (addr) landlordPropertyAddresses.get(pl.landlord_id)!.push(addr)
    }

    const result = (landlords || []).map(l => ({
      id: l.id,
      name: `${decrypt(l.first_name_encrypted) || ''} ${decrypt(l.last_name_encrypted) || ''}`.trim(),
      email: decrypt(l.email_encrypted) || '',
      property_count: propsByLandlord.get(l.id)?.size || 0,
      total_paid: payoutTotals.get(l.id) || 0,
      property_addresses: landlordPropertyAddresses.get(l.id) || [],
      has_active_tenancy: activeLandlordIds.has(l.id),
    }))

    res.json({ landlords: result })
  } catch (err: any) {
    console.error('Error getting landlords:', err)
    res.status(500).json({ error: 'Failed to get landlords' })
  }
})

// GET /api/rentgoose/tenancy/:id/history — full rent history for a tenancy
router.get('/tenancy/:id/history', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) return res.status(400).json({ error: 'Company ID required' })

    const { supabase } = await import('../config/supabase')

    const tenancyId = req.params.id

    // Get all rent schedule entries for this tenancy
    const { data: entries } = await supabase
      .from('rent_schedule_entries')
      .select('id, period_start, period_end, amount_due, amount_received, status, due_date, rent_credit_amount, rent_credit_reason, created_at')
      .eq('tenancy_id', tenancyId)
      .eq('company_id', companyId)
      .order('period_start', { ascending: true })

    // Get all rent payments for these entries
    const entryIds = (entries || []).map(e => e.id)
    const { data: payments } = entryIds.length > 0
      ? await supabase
          .from('rent_payments')
          .select('id, schedule_entry_id, amount, payment_method, date_received, reference, created_at')
          .in('schedule_entry_id', entryIds)
          .order('date_received', { ascending: true })
      : { data: [] }

    // Group payments by entry
    const paymentsByEntry = new Map<string, any[]>()
    for (const p of (payments || [])) {
      if (!paymentsByEntry.has(p.schedule_entry_id)) paymentsByEntry.set(p.schedule_entry_id, [])
      paymentsByEntry.get(p.schedule_entry_id)!.push(p)
    }

    const result = (entries || []).map(e => ({
      ...e,
      payments: paymentsByEntry.get(e.id) || []
    }))

    res.json({ history: result })
  } catch (err: any) {
    console.error('Error getting tenancy history:', err)
    res.status(500).json({ error: 'Failed to get tenancy history' })
  }
})

// POST /api/rentgoose/tenancy/:id/rent-credit — apply a rent credit to a specific schedule entry
router.post('/tenancy/:id/rent-credit', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) return res.status(400).json({ error: 'Company ID required' })

    const { supabase } = await import('../config/supabase')

    const { schedule_entry_id, credit_amount, reason } = req.body
    if (!schedule_entry_id || !credit_amount || credit_amount <= 0) {
      return res.status(400).json({ error: 'schedule_entry_id, credit_amount (> 0), and reason are required' })
    }

    // Verify the entry belongs to this tenancy and company
    const { data: entry, error: entryErr } = await supabase
      .from('rent_schedule_entries')
      .select('id, amount_due, amount_received, status, rent_credit_amount, original_amount_due')
      .eq('id', schedule_entry_id)
      .eq('tenancy_id', req.params.id)
      .eq('company_id', companyId)
      .single()

    if (entryErr || !entry) {
      return res.status(404).json({ error: 'Schedule entry not found' })
    }

    // Use original_amount_due as the base — prevents double-dipping on repeated credits
    const originalDue = parseFloat(entry.original_amount_due || entry.amount_due)
    const existingCredit = parseFloat(entry.rent_credit_amount || 0)
    const newCreditTotal = existingCredit + parseFloat(credit_amount)
    const newAmountDue = Math.max(0, originalDue - newCreditTotal)

    const updates: any = {
      amount_due: newAmountDue,
      rent_credit_amount: newCreditTotal,
      rent_credit_reason: reason,
    }

    // Persist original_amount_due on first credit so we always subtract from the true base
    if (!entry.original_amount_due) {
      updates.original_amount_due = originalDue
    }

    // If the amount already received now covers the reduced amount, mark as paid
    const amountReceived = parseFloat(entry.amount_received || 0)
    if (amountReceived >= newAmountDue && newAmountDue > 0) {
      updates.status = 'paid'
    }

    const { error: updateErr } = await supabase
      .from('rent_schedule_entries')
      .update(updates)
      .eq('id', schedule_entry_id)

    if (updateErr) {
      return res.status(500).json({ error: 'Failed to apply rent credit' })
    }

    res.json({ success: true, new_amount_due: newAmountDue, credit_total: newCreditTotal })
  } catch (err: any) {
    console.error('Error applying rent credit:', err)
    res.status(500).json({ error: 'Failed to apply rent credit' })
  }
})

// GET /api/rentgoose/landlord/:id/annual-statement — annual tax year statement
router.get('/landlord/:id/annual-statement', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) return res.status(400).json({ error: 'Company ID required' })

    const { supabase } = await import('../config/supabase')
    const { decrypt } = await import('../services/encryption')

    const landlordId = req.params.id
    const taxYear = parseInt(req.query.tax_year as string) || new Date().getFullYear()

    // Tax year: April 6 of taxYear-1 to April 5 of taxYear
    const periodStart = `${taxYear - 1}-04-06`
    const periodEnd = `${taxYear}-04-05`

    // Get all payout records for this landlord in the tax year
    const { data: payouts } = await supabase
      .from('payout_records')
      .select('*, agent_charges(*)')
      .eq('company_id', companyId)
      .eq('landlord_id', landlordId)
      .eq('payout_type', 'landlord')
      .gte('paid_at', `${periodStart}T00:00:00`)
      .lte('paid_at', `${periodEnd}T23:59:59`)
      .order('paid_at', { ascending: true })

    // Get landlord name
    const { data: landlord } = await supabase
      .from('landlords')
      .select('first_name_encrypted, last_name_encrypted')
      .eq('id', landlordId)
      .single()

    const landlordName = landlord
      ? `${decrypt(landlord.first_name_encrypted) || ''} ${decrypt(landlord.last_name_encrypted) || ''}`.trim()
      : 'Unknown'

    // Get charges for these payouts
    const payoutEntryIds = (payouts || []).map(p => p.schedule_entry_id)
    let charges: any[] = []
    if (payoutEntryIds.length > 0) {
      const { data: chargeData } = await supabase
        .from('agent_charges')
        .select('*')
        .in('schedule_entry_id', payoutEntryIds)
        .eq('included', true)
      charges = chargeData || []
    }

    // Build line items
    const items = (payouts || []).map(p => {
      const entryCharges = charges.filter(c => c.schedule_entry_id === p.schedule_entry_id)
      return {
        date: p.paid_at,
        gross_rent: parseFloat(p.gross_rent),
        charges: entryCharges.map(c => ({
          description: c.description,
          net_amount: parseFloat(c.net_amount),
          vat_amount: parseFloat(c.vat_amount),
          gross_amount: parseFloat(c.gross_amount),
        })),
        total_charges: parseFloat(p.total_charges),
        net_payout: parseFloat(p.net_payout),
        statement_ref: p.id.substring(0, 8).toUpperCase(),
      }
    })

    const totalGross = items.reduce((s, i) => s + i.gross_rent, 0)
    const totalChargesNet = charges.reduce((s, c) => s + parseFloat(c.net_amount), 0)
    const totalChargesVat = charges.reduce((s, c) => s + parseFloat(c.vat_amount), 0)
    const totalChargesGross = charges.reduce((s, c) => s + parseFloat(c.gross_amount), 0)
    const totalNet = items.reduce((s, i) => s + i.net_payout, 0)

    res.json({
      landlord_name: landlordName,
      tax_year: `${taxYear - 1}/${taxYear}`,
      period_start: periodStart,
      period_end: periodEnd,
      items,
      totals: {
        gross_income: totalGross,
        charges_net: totalChargesNet,
        charges_vat: totalChargesVat,
        charges_gross: totalChargesGross,
        net_paid: totalNet,
      },
    })
  } catch (err: any) {
    console.error('Error getting annual statement:', err)
    res.status(500).json({ error: 'Failed to get annual statement' })
  }
})

// POST /api/rentgoose/landlord/:id/annual-statement/email
router.post('/landlord/:id/annual-statement/email', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) return res.status(400).json({ error: 'Company ID required' })

    const { supabase } = await import('../config/supabase')
    const { decrypt } = await import('../services/encryption')
    const { sendEmail, loadEmailTemplate } = await import('../services/emailService')

    const landlordId = req.params.id
    const taxYear = parseInt(req.body.tax_year as string) || new Date().getFullYear()

    const periodStart = `${taxYear - 1}-04-06`
    const periodEnd = `${taxYear}-04-05`

    // Get landlord details + email
    const { data: landlord } = await supabase
      .from('landlords')
      .select('first_name_encrypted, last_name_encrypted, email_encrypted')
      .eq('id', landlordId)
      .single()

    if (!landlord) return res.status(404).json({ error: 'Landlord not found' })

    const landlordName = `${decrypt(landlord.first_name_encrypted) || ''} ${decrypt(landlord.last_name_encrypted) || ''}`.trim()
    const landlordEmail = decrypt(landlord.email_encrypted)
    if (!landlordEmail) return res.status(400).json({ error: 'Landlord has no email address on file' })

    // Get company branding
    const { data: company } = await supabase
      .from('companies')
      .select('name_encrypted, logo_url, email_encrypted, phone_encrypted, primary_color')
      .eq('id', companyId)
      .single()

    const companyName = (company?.name_encrypted ? decrypt(company.name_encrypted) : null) || 'PropertyGoose'
    const companyLogo = company?.logo_url || 'https://app.propertygoose.co.uk/PropertyGooseLogo.png'
    const companyEmail = (company?.email_encrypted ? decrypt(company.email_encrypted) : null) || ''
    const companyPhone = (company?.phone_encrypted ? decrypt(company.phone_encrypted) : null) || ''
    const brandColor = company?.primary_color || '#f97316'

    // Fetch payouts for tax year
    const { data: payouts } = await supabase
      .from('payout_records')
      .select('*')
      .eq('company_id', companyId)
      .eq('landlord_id', landlordId)
      .eq('payout_type', 'landlord')
      .gte('paid_at', `${periodStart}T00:00:00`)
      .lte('paid_at', `${periodEnd}T23:59:59`)
      .order('paid_at', { ascending: true })

    const payoutEntryIds = (payouts || []).map((p: any) => p.schedule_entry_id).filter(Boolean)
    let charges: any[] = []
    if (payoutEntryIds.length > 0) {
      const { data: chargeData } = await supabase
        .from('agent_charges')
        .select('*')
        .in('schedule_entry_id', payoutEntryIds)
        .eq('included', true)
      charges = chargeData || []
    }

    const items = (payouts || []).map((p: any) => {
      const entryCharges = charges.filter((c: any) => c.schedule_entry_id === p.schedule_entry_id)
      return {
        date: p.paid_at,
        gross_rent: parseFloat(p.gross_rent),
        total_charges: parseFloat(p.total_charges),
        net_payout: parseFloat(p.net_payout),
        statement_ref: p.id.substring(0, 8).toUpperCase(),
        charges: entryCharges,
      }
    })

    const totalGross = items.reduce((s: number, i: any) => s + i.gross_rent, 0)
    const totalDeductions = items.reduce((s: number, i: any) => s + i.total_charges, 0)
    const totalNet = items.reduce((s: number, i: any) => s + i.net_payout, 0)
    const totalVat = charges.reduce((s: number, c: any) => s + parseFloat(c.vat_amount || 0), 0)
    const totalChargesNet = charges.reduce((s: number, c: any) => s + parseFloat(c.net_amount || 0), 0)

    const fmt = (n: number) => n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    const fmtDate = (s: string) => s ? new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : ''

    // Build item rows HTML
    const itemRows = items.map((item: any, idx: number) => {
      const bg = idx % 2 === 1 ? 'background-color: #fafafa;' : ''
      return `<tr style="${bg}">
        <td style="padding: 10px 14px; color: #374151; border-bottom: 1px solid #f3f4f6;">${fmtDate(item.date)}</td>
        <td style="padding: 10px 14px; color: #6b7280; border-bottom: 1px solid #f3f4f6; font-size: 12px;">${item.statement_ref}</td>
        <td style="padding: 10px 14px; text-align: right; color: #15803d; font-weight: 600; border-bottom: 1px solid #f3f4f6;">&pound;${fmt(item.gross_rent)}</td>
        <td style="padding: 10px 14px; text-align: right; color: #dc2626; border-bottom: 1px solid #f3f4f6;">-&pound;${fmt(item.total_charges)}</td>
        <td style="padding: 10px 14px; text-align: right; color: #1d4ed8; font-weight: 600; border-bottom: 1px solid #f3f4f6;">&pound;${fmt(item.net_payout)}</td>
      </tr>`
    }).join('')

    const html = loadEmailTemplate('landlord-annual-statement', {
      LandlordName: landlordName,
      TaxYear: `${taxYear - 1}/${taxYear}`,
      PeriodStart: fmtDate(`${periodStart}T00:00:00`),
      PeriodEnd: fmtDate(`${periodEnd}T00:00:00`),
      TotalGross: fmt(totalGross),
      TotalDeductions: fmt(totalDeductions),
      TotalNet: fmt(totalNet),
      TotalVat: fmt(totalVat),
      TotalChargesNet: fmt(totalChargesNet),
      ItemRows: itemRows,
      CompanyName: companyName,
      AgentLogoUrl: companyLogo,
      CompanyEmail: companyEmail,
      CompanyPhone: companyPhone,
      BrandColor: brandColor,
      Year: new Date().getFullYear().toString(),
    })

    await sendEmail({
      to: landlordEmail,
      subject: `${companyName} - Annual Tax Statement ${taxYear - 1}/${taxYear}`,
      html,
      companyId,
      emailCategory: 'annual_statement',
    })

    res.json({ success: true, sent_to: landlordEmail })
  } catch (err: any) {
    console.error('Error sending annual statement:', err)
    res.status(500).json({ error: err.message || 'Failed to send annual statement' })
  }
})

export default router
