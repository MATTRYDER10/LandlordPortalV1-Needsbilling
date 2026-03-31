import { supabase } from '../config/supabase'
import { decrypt } from './encryption'

// ============================================================================
// INTERFACES
// ============================================================================

export interface ScheduleEntry {
  id: string
  tenancy_id: string
  company_id: string
  period_start: string
  period_end: string
  amount_due: number
  amount_received: number
  status: string
  due_date: string
  // Joined data
  property_address?: string
  property_postcode?: string
  property_id?: string
  landlord_name?: string
  landlord_id?: string
  tenant_names?: string
  tenancy_ref?: string
  fee_percent?: number
  management_type?: string
}

export interface PayoutItem {
  id: string
  schedule_entry_id: string
  property_id: string
  property_address: string
  property_postcode: string
  landlord_name: string
  landlord_id: string
  landlord_email?: string
  landlord_bank_name?: string
  landlord_bank_account_last4?: string
  landlord_bank_sort_code?: string
  tenant_names: string
  tenancy_ref: string
  period_start: string
  period_end: string
  gross_rent: number
  charges: AgentChargeItem[]
  total_charges: number
  net_payout: number
  statement_ref: string
}

export interface AgentChargeItem {
  id: string
  charge_type: string
  description: string
  net_amount: number
  vat_amount: number
  gross_amount: number
  included: boolean
  contractor_invoice_id?: string
}

// ============================================================================
// INIT TENANCY SCHEDULE
// ============================================================================

export async function initTenancySchedule(tenancyId: string, companyId: string): Promise<void> {
  // Get tenancy details
  const { data: tenancy, error: tenancyErr } = await supabase
    .from('tenancies')
    .select('id, tenancy_start_date, tenancy_end_date, rent_amount, monthly_rent, rent_due_day, status, property_id')
    .eq('id', tenancyId)
    .single()

  if (tenancyErr || !tenancy) {
    console.error('Failed to get tenancy for schedule init:', tenancyErr)
    return
  }

  const monthlyRent = parseFloat(tenancy.rent_amount || tenancy.monthly_rent || 0)
  const rentDueDay = tenancy.rent_due_day || 1
  const startDate = new Date(tenancy.tenancy_start_date)
  const endDate = tenancy.tenancy_end_date ? new Date(tenancy.tenancy_end_date) : null

  // Check if schedule already exists
  const { count } = await supabase
    .from('rent_schedule_entries')
    .select('id', { count: 'exact', head: true })
    .eq('tenancy_id', tenancyId)

  if (count && count > 0) return // Already initialised

  // Determine how many periods to generate
  // Fixed term: full duration. Rolling: 3 months forward
  let periodsToGenerate: number
  if (endDate) {
    const monthsDiff = (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth())
    periodsToGenerate = Math.max(monthsDiff, 1)
  } else {
    periodsToGenerate = 3
  }

  const entries: any[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (let i = 0; i < periodsToGenerate; i++) {
    const periodStart = new Date(startDate)
    periodStart.setMonth(periodStart.getMonth() + i)

    const periodEnd = new Date(periodStart)
    periodEnd.setMonth(periodEnd.getMonth() + 1)
    periodEnd.setDate(periodEnd.getDate() - 1)

    const dueDate = new Date(periodStart.getFullYear(), periodStart.getMonth(), rentDueDay)
    // If due day hasn't been reached yet in first month, use the correct due date
    if (dueDate < periodStart) {
      dueDate.setMonth(dueDate.getMonth() + 1)
    }

    let status = 'upcoming'
    const dueDateOnly = new Date(dueDate)
    dueDateOnly.setHours(0, 0, 0, 0)

    if (dueDateOnly.getTime() === today.getTime()) {
      status = 'due'
    } else if (dueDateOnly < today) {
      status = 'overdue'
    }

    entries.push({
      company_id: companyId,
      tenancy_id: tenancyId,
      period_start: periodStart.toISOString().split('T')[0],
      period_end: periodEnd.toISOString().split('T')[0],
      amount_due: monthlyRent,
      amount_received: 0,
      status,
      due_date: dueDate.toISOString().split('T')[0],
    })
  }

  if (entries.length > 0) {
    const { error } = await supabase
      .from('rent_schedule_entries')
      .insert(entries)

    if (error) {
      console.error('Failed to create rent schedule:', error)
    }
  }

  // Create rent share allocations for HMO tenancies
  await initRentShareAllocations(tenancyId, companyId)
}

async function initRentShareAllocations(tenancyId: string, companyId: string): Promise<void> {
  // Get tenants with rent shares
  const { data: tenants } = await supabase
    .from('tenancy_tenants')
    .select('id, rent_share_amount, rent_share_percentage')
    .eq('tenancy_id', tenancyId)
    .eq('status', 'active')

  if (!tenants || tenants.length <= 1) return // Not HMO

  // Get schedule entries
  const { data: entries } = await supabase
    .from('rent_schedule_entries')
    .select('id, amount_due')
    .eq('tenancy_id', tenancyId)

  if (!entries) return

  const allocations: any[] = []
  for (const entry of entries) {
    for (const tenant of tenants) {
      const sharePercent = tenant.rent_share_percentage || (100 / tenants.length)
      allocations.push({
        company_id: companyId,
        schedule_entry_id: entry.id,
        tenant_id: tenant.id,
        share_percent: sharePercent,
        amount_due: (sharePercent / 100) * entry.amount_due,
        amount_received: 0,
        status: 'unpaid',
      })
    }
  }

  if (allocations.length > 0) {
    await supabase.from('rent_share_allocations').insert(allocations)
  }
}

// ============================================================================
// EXTEND ROLLING SCHEDULE
// ============================================================================

export async function extendRollingSchedule(tenancyId: string, companyId: string): Promise<void> {
  const { data: tenancy } = await supabase
    .from('tenancies')
    .select('tenancy_end_date, rent_amount, monthly_rent, rent_due_day')
    .eq('id', tenancyId)
    .single()

  if (!tenancy || tenancy.tenancy_end_date) return // Fixed term, don't extend

  // Get latest schedule entry
  const { data: latest } = await supabase
    .from('rent_schedule_entries')
    .select('period_end')
    .eq('tenancy_id', tenancyId)
    .neq('status', 'cancelled')
    .order('period_end', { ascending: false })
    .limit(1)
    .single()

  if (!latest) return

  const latestEnd = new Date(latest.period_end)
  const threeMonthsFromNow = new Date()
  threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3)

  if (latestEnd >= threeMonthsFromNow) return // Already enough entries

  const monthlyRent = parseFloat(tenancy.rent_amount || tenancy.monthly_rent || 0)
  const rentDueDay = tenancy.rent_due_day || 1
  const entries: any[] = []

  let current = new Date(latestEnd)
  current.setDate(current.getDate() + 1)

  while (current < threeMonthsFromNow) {
    const periodStart = new Date(current)
    const periodEnd = new Date(current)
    periodEnd.setMonth(periodEnd.getMonth() + 1)
    periodEnd.setDate(periodEnd.getDate() - 1)

    const dueDate = new Date(periodStart.getFullYear(), periodStart.getMonth(), rentDueDay)
    if (dueDate < periodStart) dueDate.setMonth(dueDate.getMonth() + 1)

    entries.push({
      company_id: companyId,
      tenancy_id: tenancyId,
      period_start: periodStart.toISOString().split('T')[0],
      period_end: periodEnd.toISOString().split('T')[0],
      amount_due: monthlyRent,
      amount_received: 0,
      status: 'upcoming',
      due_date: dueDate.toISOString().split('T')[0],
    })

    current.setMonth(current.getMonth() + 1)
  }

  if (entries.length > 0) {
    await supabase.from('rent_schedule_entries').insert(entries)
  }
}

// ============================================================================
// GET RENT SCHEDULE (Board data)
// ============================================================================

export async function getRentSchedule(companyId: string, filters: {
  status?: string
  landlord_id?: string
  property_id?: string
  date_from?: string
  date_to?: string
}): Promise<ScheduleEntry[]> {
  let query = supabase
    .from('rent_schedule_entries')
    .select('*')
    .eq('company_id', companyId)
    .order('due_date', { ascending: true })

  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status)
  } else {
    // Default: exclude cancelled
    query = query.neq('status', 'cancelled')
  }

  if (filters.date_from) query = query.gte('due_date', filters.date_from)
  if (filters.date_to) query = query.lte('due_date', filters.date_to)

  const { data: entries, error } = await query
  if (error) throw error

  if (!entries || entries.length === 0) return []

  // Get unique tenancy IDs and enrich with tenancy/property/landlord data
  const tenancyIds = [...new Set(entries.map(e => e.tenancy_id))]

  const { data: tenancies } = await supabase
    .from('tenancies')
    .select('id, property_id, rent_amount, monthly_rent')
    .in('id', tenancyIds)

  if (!tenancies) return entries

  const propertyIds = [...new Set(tenancies.map(t => t.property_id).filter(Boolean))]

  const { data: properties } = await supabase
    .from('properties')
    .select('id, address_line1_encrypted, postcode, fee_percent, management_type')
    .in('id', propertyIds)

  // Get landlord links
  const { data: propertyLandlords } = await supabase
    .from('property_landlords')
    .select('property_id, landlord_id')
    .in('property_id', propertyIds)
    .eq('is_primary_contact', true)

  const landlordIds = [...new Set((propertyLandlords || []).map(pl => pl.landlord_id))]
  const { data: landlords } = landlordIds.length > 0
    ? await supabase.from('landlords').select('id, first_name_encrypted, last_name_encrypted').in('id', landlordIds)
    : { data: [] }

  // Get tenants
  const { data: tenancyTenants } = await supabase
    .from('tenancy_tenants')
    .select('tenancy_id, tenant_name_encrypted, tenant_email_encrypted, status')
    .in('tenancy_id', tenancyIds)

  // Build lookup maps
  const tenancyMap = new Map(tenancies.map(t => [t.id, t]))
  const propertyMap = new Map((properties || []).map(p => [p.id, p]))
  const landlordMap = new Map((landlords || []).map(l => [l.id, l]))
  const propertyLandlordMap = new Map((propertyLandlords || []).map(pl => [pl.property_id, pl.landlord_id]))

  // Group tenants by tenancy
  const tenantsByTenancy = new Map<string, any[]>()
  for (const tt of (tenancyTenants || [])) {
    const existing = tenantsByTenancy.get(tt.tenancy_id) || []
    existing.push(tt)
    tenantsByTenancy.set(tt.tenancy_id, existing)
  }

  // Filter by landlord/property if needed
  const enriched: ScheduleEntry[] = []
  for (const entry of entries) {
    const tenancy = tenancyMap.get(entry.tenancy_id)
    if (!tenancy) continue

    const property = propertyMap.get(tenancy.property_id)
    if (!property) continue

    if (filters.property_id && tenancy.property_id !== filters.property_id) continue

    const landlordId = propertyLandlordMap.get(tenancy.property_id)
    if (filters.landlord_id && landlordId !== filters.landlord_id) continue

    const landlord = landlordId ? landlordMap.get(landlordId) : null
    const tenants = tenantsByTenancy.get(entry.tenancy_id) || []

    const landlordName = landlord
      ? `${decrypt(landlord.first_name_encrypted) || ''} ${decrypt(landlord.last_name_encrypted) || ''}`.trim()
      : 'Unknown'

    const tenantNames = tenants
      .filter(t => !t.status || t.status === 'active')
      .map(t => decrypt(t.tenant_name_encrypted) || 'Tenant')
      .join(', ')

    // Recompute status from due_date (don't rely on stored status for unpaid entries)
    let computedStatus = entry.status
    if (entry.status !== 'paid' && entry.status !== 'partial' && entry.status !== 'cancelled') {
      const todayStr = new Date().toISOString().split('T')[0]
      if (entry.due_date < todayStr) computedStatus = 'arrears'
      else if (entry.due_date === todayStr) computedStatus = 'due'
      else computedStatus = 'scheduled'
    }

    enriched.push({
      id: entry.id,
      tenancy_id: entry.tenancy_id,
      company_id: entry.company_id,
      period_start: entry.period_start,
      period_end: entry.period_end,
      amount_due: parseFloat(entry.amount_due),
      amount_received: parseFloat(entry.amount_received),
      status: computedStatus,
      due_date: entry.due_date,
      property_address: decrypt(property.address_line1_encrypted) || '',
      property_postcode: property.postcode || '',
      property_id: tenancy.property_id,
      landlord_name: landlordName,
      landlord_id: landlordId || undefined,
      tenant_names: tenantNames,
      tenancy_ref: entry.tenancy_id.substring(0, 8).toUpperCase(),
      fee_percent: property.fee_percent ? parseFloat(property.fee_percent) : undefined,
      management_type: property.management_type,
    })
  }

  // Apply computed status filter if requested
  if (filters.status && filters.status !== 'all' && filters.status !== 'partial' && filters.status !== 'paid') {
    return enriched.filter(e => e.status === filters.status)
  }

  return enriched
}

// ============================================================================
// RECEIPT PAYMENT
// ============================================================================

export async function receiptPayment(companyId: string, input: {
  schedule_entry_id: string
  amount: number
  payment_method: string
  date_received: string
  reference?: string
  created_by?: string
  tenant_id?: string
  charges: Array<{
    charge_type: string
    description: string
    net_amount: number
    vat_amount: number
    gross_amount: number
    included: boolean
    contractor_invoice_id?: string
  }>
  partial_action?: 'hold' | 'payout_now'
}): Promise<{ payment_id: string; payout_ready: boolean }> {
  // Get current schedule entry
  const { data: entry, error: entryErr } = await supabase
    .from('rent_schedule_entries')
    .select('*')
    .eq('id', input.schedule_entry_id)
    .eq('company_id', companyId)
    .single()

  if (entryErr || !entry) throw new Error('Schedule entry not found')

  const newTotalReceived = parseFloat(entry.amount_received) + input.amount
  const amountDue = parseFloat(entry.amount_due)
  const isPartial = newTotalReceived < amountDue
  const isFullyPaid = newTotalReceived >= amountDue

  // 1. Create RentPayment
  const { data: payment, error: paymentErr } = await supabase
    .from('rent_payments')
    .insert({
      company_id: companyId,
      schedule_entry_id: input.schedule_entry_id,
      tenant_id: input.tenant_id || null,
      amount: input.amount,
      payment_method: input.payment_method,
      date_received: input.date_received,
      reference: input.reference || null,
      created_by: input.created_by || null,
    })
    .select()
    .single()

  if (paymentErr) throw paymentErr

  // 2. Create ClientAccountEntry (rent_in)
  const currentBalance = await getCurrentBalance(companyId)
  const newBalance = currentBalance + input.amount

  const { data: clientEntry } = await supabase
    .from('client_account_entries')
    .insert({
      company_id: companyId,
      entry_type: 'rent_in',
      amount: input.amount,
      description: `Rent received for ${entry.period_start} to ${entry.period_end}`,
      reference: input.reference || null,
      related_id: payment.id,
      related_type: 'rent_payment',
      balance_after: newBalance,
      created_by: input.created_by || null,
      is_manual: false,
    })
    .select()
    .single()

  // Update payment with client account entry link
  if (clientEntry) {
    await supabase
      .from('rent_payments')
      .update({ client_account_entry_id: clientEntry.id })
      .eq('id', payment.id)
  }

  // 3. Update RentScheduleEntry
  const newStatus = isFullyPaid ? 'paid' : 'partial'
  await supabase
    .from('rent_schedule_entries')
    .update({
      amount_received: newTotalReceived,
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.schedule_entry_id)

  // 4. Create AgentCharges — clear any pre-existing charges first (e.g. from Raise Invoice)
  // then insert the user's final selection from the receipt modal
  await supabase.from('agent_charges').delete().eq('schedule_entry_id', input.schedule_entry_id)

  if (input.charges.length > 0) {
    const chargeInserts = input.charges.map(c => ({
      company_id: companyId,
      schedule_entry_id: input.schedule_entry_id,
      charge_type: c.charge_type,
      description: c.description,
      net_amount: c.net_amount,
      vat_amount: c.vat_amount,
      gross_amount: c.gross_amount,
      included: c.included,
      contractor_invoice_id: c.contractor_invoice_id || null,
    }))

    await supabase.from('agent_charges').insert(chargeInserts)
  }

  // 5. Handle partial payment
  if (isPartial) {
    const outstanding = amountDue - newTotalReceived
    await supabase.from('arrears_chases').insert({
      company_id: companyId,
      schedule_entry_id: input.schedule_entry_id,
      tenant_id: input.tenant_id || null,
      amount_outstanding: outstanding,
      partial_paid: input.amount,
      partial_paid_date: input.date_received,
      status: 'active',
    })
  }

  // 6. Update rent share allocations if tenant-specific payment
  if (input.tenant_id) {
    const { data: allocation } = await supabase
      .from('rent_share_allocations')
      .select('*')
      .eq('schedule_entry_id', input.schedule_entry_id)
      .eq('tenant_id', input.tenant_id)
      .single()

    if (allocation) {
      const newReceived = parseFloat(allocation.amount_received) + input.amount
      const allocStatus = newReceived >= parseFloat(allocation.amount_due) ? 'paid' : newReceived > 0 ? 'partial' : 'unpaid'

      await supabase
        .from('rent_share_allocations')
        .update({
          amount_received: newReceived,
          status: allocStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', allocation.id)
    }
  }

  // Payout ready if fully paid, or if partial with payout_now option
  const payoutReady = isFullyPaid || (isPartial && input.partial_action === 'payout_now')

  return { payment_id: payment.id, payout_ready: payoutReady }
}

// ============================================================================
// GET PAYOUTS QUEUE
// ============================================================================

export async function getPayoutsQueue(companyId: string): Promise<PayoutItem[]> {
  // Get all paid/partial entries that don't have a payout record yet
  const { data: entries } = await supabase
    .from('rent_schedule_entries')
    .select('*')
    .eq('company_id', companyId)
    .in('status', ['paid', 'partial'])

  if (!entries || entries.length === 0) return []

  // Check which already have payout records
  const entryIds = entries.map(e => e.id)
  const { data: existingPayouts } = await supabase
    .from('payout_records')
    .select('schedule_entry_id')
    .in('schedule_entry_id', entryIds)
    .eq('payout_type', 'landlord')

  const paidOutIds = new Set((existingPayouts || []).map(p => p.schedule_entry_id))
  const unpaidEntries = entries.filter(e => !paidOutIds.has(e.id))

  if (unpaidEntries.length === 0) return []

  // Enrich with tenancy/property/landlord data
  const tenancyIds = [...new Set(unpaidEntries.map(e => e.tenancy_id))]
  const { data: tenancies } = await supabase
    .from('tenancies')
    .select('id, property_id')
    .in('id', tenancyIds)

  const propertyIds = [...new Set((tenancies || []).map(t => t.property_id).filter(Boolean))]
  const { data: properties } = await supabase
    .from('properties')
    .select('id, address_line1_encrypted, postcode, fee_percent, fee_type, management_fee_type, letting_fee_amount, letting_fee_type, service_type_id')
    .in('id', propertyIds)

  // Get recurring property charges for these properties
  const { data: propertyCharges } = await supabase
    .from('property_charges')
    .select('*')
    .in('property_id', propertyIds)
    .eq('company_id', companyId)

  const { data: propertyLandlords } = await supabase
    .from('property_landlords')
    .select('property_id, landlord_id')
    .in('property_id', propertyIds)
    .eq('is_primary_contact', true)

  const landlordIds = [...new Set((propertyLandlords || []).map(pl => pl.landlord_id))]
  const { data: landlords } = landlordIds.length > 0
    ? await supabase.from('landlords').select('id, first_name_encrypted, last_name_encrypted, email_encrypted, bank_account_name_encrypted, bank_account_number_encrypted, bank_sort_code_encrypted').in('id', landlordIds)
    : { data: [] }

  const { data: tenancyTenants } = await supabase
    .from('tenancy_tenants')
    .select('tenancy_id, tenant_name_encrypted, status')
    .in('tenancy_id', tenancyIds)

  // Get charges for these entries
  const { data: allCharges } = await supabase
    .from('agent_charges')
    .select('*')
    .in('schedule_entry_id', unpaidEntries.map(e => e.id))

  // Build lookups
  const tenancyMap = new Map((tenancies || []).map(t => [t.id, t]))
  const propertyMap = new Map((properties || []).map(p => [p.id, p]))
  const landlordMap = new Map((landlords || []).map(l => [l.id, l]))
  const propertyLandlordMap = new Map((propertyLandlords || []).map(pl => [pl.property_id, pl.landlord_id]))
  const tenantsByTenancy = new Map<string, any[]>()
  for (const tt of (tenancyTenants || [])) {
    const existing = tenantsByTenancy.get(tt.tenancy_id) || []
    existing.push(tt)
    tenantsByTenancy.set(tt.tenancy_id, existing)
  }
  const chargesByEntry = new Map<string, any[]>()
  for (const c of (allCharges || [])) {
    const existing = chargesByEntry.get(c.schedule_entry_id) || []
    existing.push(c)
    chargesByEntry.set(c.schedule_entry_id, existing)
  }

  const propertyChargesByProperty = new Map<string, any[]>()
  for (const pc of (propertyCharges || [])) {
    const existing = propertyChargesByProperty.get(pc.property_id) || []
    existing.push(pc)
    propertyChargesByProperty.set(pc.property_id, existing)
  }

  const payouts: PayoutItem[] = []
  for (const entry of unpaidEntries) {
    const tenancy = tenancyMap.get(entry.tenancy_id)
    if (!tenancy) continue

    const property = propertyMap.get(tenancy.property_id)
    if (!property) continue

    const landlordId = propertyLandlordMap.get(tenancy.property_id)
    const landlord = landlordId ? landlordMap.get(landlordId) : null

    const tenants = tenantsByTenancy.get(entry.tenancy_id) || []
    const grossRent = parseFloat(entry.amount_received)

    // Start with any existing agent_charges (from receipting or raised invoices)
    const charges: AgentChargeItem[] = (chargesByEntry.get(entry.id) || []).map((c: any) => ({
      id: c.id,
      charge_type: c.charge_type,
      description: c.description,
      net_amount: parseFloat(c.net_amount),
      vat_amount: parseFloat(c.vat_amount),
      gross_amount: parseFloat(c.gross_amount),
      included: c.included,
      contractor_invoice_id: c.contractor_invoice_id,
    }))

    // Only auto-generate charges if none were recorded during receipting
    // If agent_charges exist for this entry, the user already made their selections
    const hasExistingCharges = chargesByEntry.has(entry.id)

    if (!hasExistingCharges) {
      // Auto-calculate management fee from property
      if (property.fee_percent) {
        const feePercent = parseFloat(property.fee_percent)
        if (feePercent > 0) {
          let netFee: number
          if (property.management_fee_type === 'fixed') {
            netFee = feePercent
          } else {
            netFee = Math.round((feePercent / 100) * grossRent * 100) / 100
          }
          const vatFee = Math.round(netFee * 0.20 * 100) / 100
          charges.push({
            id: `auto-mgmt-${entry.id}`,
            charge_type: 'management_fee',
            description: property.management_fee_type === 'fixed' ? `Management fee (£${netFee.toFixed(2)}/month)` : `Management fee at ${feePercent}%`,
            net_amount: netFee,
            vat_amount: vatFee,
            gross_amount: Math.round((netFee + vatFee) * 100) / 100,
            included: true,
          })
        }
      }

      // Add recurring property charges
      const propCharges = propertyChargesByProperty.get(tenancy.property_id) || []
      for (const pc of propCharges) {
        const amt = parseFloat(pc.amount)
        const vat = pc.is_vatable ? Math.round(amt * 0.20 * 100) / 100 : 0
        charges.push({
          id: `prop-charge-${pc.id}`,
          charge_type: 'ad_hoc',
          description: pc.description,
          net_amount: amt,
          vat_amount: vat,
          gross_amount: Math.round((amt + vat) * 100) / 100,
          included: true,
        })
      }
    }

    const includedCharges = charges.filter((c: AgentChargeItem) => c.included)
    const totalCharges = includedCharges.reduce((sum: number, c: AgentChargeItem) => sum + c.gross_amount, 0)
    const netPayout = grossRent - totalCharges

    const landlordName = landlord
      ? `${decrypt(landlord.first_name_encrypted) || ''} ${decrypt(landlord.last_name_encrypted) || ''}`.trim()
      : 'Unknown'

    const statementRef = `RG-${Date.now().toString(36).toUpperCase()}-${entry.id.substring(0, 4).toUpperCase()}`

    payouts.push({
      id: entry.id,
      schedule_entry_id: entry.id,
      property_id: tenancy.property_id,
      property_address: decrypt(property.address_line1_encrypted) || '',
      property_postcode: property.postcode || '',
      landlord_name: landlordName,
      landlord_id: landlordId || '',
      landlord_email: landlord ? decrypt(landlord.email_encrypted) || undefined : undefined,
      landlord_bank_name: landlord?.bank_account_name_encrypted ? decrypt(landlord.bank_account_name_encrypted) || undefined : undefined,
      landlord_bank_account_last4: landlord?.bank_account_number_encrypted
        ? (decrypt(landlord.bank_account_number_encrypted) || '').slice(-4) || undefined
        : undefined,
      landlord_bank_sort_code: landlord?.bank_sort_code_encrypted ? decrypt(landlord.bank_sort_code_encrypted) || undefined : undefined,
      tenant_names: tenants
        .filter((t: any) => !t.status || t.status === 'active')
        .map((t: any) => decrypt(t.tenant_name_encrypted) || 'Tenant')
        .join(', '),
      tenancy_ref: entry.tenancy_id.substring(0, 8).toUpperCase(),
      period_start: entry.period_start,
      period_end: entry.period_end,
      gross_rent: grossRent,
      charges,
      total_charges: totalCharges,
      net_payout: netPayout,
      statement_ref: statementRef,
    })
  }

  return payouts
}

// ============================================================================
// MARK PAYOUT PAID
// ============================================================================

export async function markPayoutPaid(companyId: string, input: {
  schedule_entry_id: string
  paid_by?: string
  send_statement: boolean
  log_statement: boolean
  send_tenant_receipt: boolean
}): Promise<{ payout_id: string; pdf_path?: string }> {
  // Get entry and related data
  const payouts = await getPayoutsQueue(companyId)
  const payout = payouts.find(p => p.schedule_entry_id === input.schedule_entry_id)
  if (!payout) throw new Error('Payout not found in queue')

  // Get company details for email
  const { data: company } = await supabase
    .from('companies')
    .select('name_encrypted, logo_url')
    .eq('id', companyId)
    .single()
  const companyName = (company?.name_encrypted ? decrypt(company.name_encrypted) : null) || 'PropertyGoose'
  const companyLogo = company?.logo_url || ''

  // Generate statement PDF
  let pdfPath: string | undefined
  let pdfBuffer: Buffer | undefined
  try {
    console.log('[Payout] Generating statement PDF for', payout.landlord_name, payout.property_address)
    const { generateLandlordStatement } = await import('./rentgooseStatementService')
    const result = await generateLandlordStatement(companyId, payout)
    pdfPath = result.storagePath
    pdfBuffer = result.pdfBuffer
    console.log('[Payout] Statement PDF generated:', pdfPath, 'size:', pdfBuffer?.length, 'bytes')
  } catch (err) {
    console.error('[Payout] Failed to generate statement PDF:', err)
  }

  // Create payout record
  const { data: payoutRecord, error: payoutErr } = await supabase
    .from('payout_records')
    .insert({
      company_id: companyId,
      schedule_entry_id: input.schedule_entry_id,
      landlord_id: payout.landlord_id || null,
      payout_type: 'landlord',
      gross_rent: payout.gross_rent,
      total_charges: payout.total_charges,
      net_payout: payout.net_payout,
      paid_by: input.paid_by || null,
      statement_pdf_path: pdfPath || null,
    })
    .select()
    .single()

  if (payoutErr) throw payoutErr

  // Create ClientAccountEntry (payout_out)
  const currentBalance = await getCurrentBalance(companyId)
  const newBalance = currentBalance - payout.net_payout

  const { data: clientEntry } = await supabase
    .from('client_account_entries')
    .insert({
      company_id: companyId,
      entry_type: 'payout_out',
      amount: payout.net_payout,
      description: `Payout to ${payout.landlord_name} for ${payout.property_address}`,
      related_id: payoutRecord.id,
      related_type: 'payout_record',
      balance_after: newBalance,
      created_by: input.paid_by || null,
      is_manual: false,
    })
    .select()
    .single()

  if (clientEntry) {
    await supabase
      .from('payout_records')
      .update({ client_account_entry_id: clientEntry.id })
      .eq('id', payoutRecord.id)
  }

  // Send statement email if requested
  console.log('[Payout] Email check — send_statement:', input.send_statement, 'landlord_email:', payout.landlord_email, 'pdfPath:', pdfPath)
  if (input.send_statement && payout.landlord_email && pdfPath) {
    try {
      const { sendEmail, loadEmailTemplate } = await import('./emailService')
      const html = loadEmailTemplate('landlord-statement', {
        LandlordName: payout.landlord_name,
        PropertyAddress: `${payout.property_address}, ${payout.property_postcode}`,
        PeriodStart: payout.period_start,
        PeriodEnd: payout.period_end,
        NetPayout: payout.net_payout.toFixed(2),
        CompanyName: companyName,
        AgentLogoUrl: companyLogo,
      })

      await sendEmail({
        to: payout.landlord_email,
        subject: `Rental Statement - ${payout.property_address}`,
        html,
        companyId,
        emailCategory: 'landlord_statement',
      })

      await supabase
        .from('payout_records')
        .update({ statement_sent_at: new Date().toISOString() })
        .eq('id', payoutRecord.id)
    } catch (err) {
      console.error('Failed to send statement email:', err)
    }
  }

  // Save statement to landlord documents if PDF was generated
  if (pdfPath && payout.landlord_id) {
    try {
      // Save as a property document linked to the landlord
      await supabase
        .from('property_documents')
        .insert({
          property_id: payout.property_id,
          company_id: companyId,
          file_name: `Statement-${payout.statement_ref}.pdf`,
          file_path: pdfPath,
          file_type: 'application/pdf',
          file_size: pdfBuffer?.length || 0,
          tag: 'statement',
          description: `Rental statement for ${payout.period_start} to ${payout.period_end}`,
          uploaded_by: input.paid_by || null,
        })
    } catch (err) {
      console.error('Failed to save statement to documents:', err)
    }
  }

  // Send tenant receipt if requested
  if (input.send_tenant_receipt) {
    try {
      await sendTenantReceipt(companyId, input.schedule_entry_id)
    } catch (err) {
      console.error('Failed to send tenant receipt:', err)
    }
  }

  return { payout_id: payoutRecord.id, pdf_path: pdfPath }
}

// ============================================================================
// BATCH PAYOUT
// ============================================================================

export async function batchPayout(companyId: string, input: {
  schedule_entry_ids: string[]
  paid_by?: string
  send_statements: boolean
  log_statements: boolean
  send_tenant_receipts: boolean
}): Promise<{ processed: number; failed: number }> {
  let processed = 0
  let failed = 0

  for (const entryId of input.schedule_entry_ids) {
    try {
      await markPayoutPaid(companyId, {
        schedule_entry_id: entryId,
        paid_by: input.paid_by,
        send_statement: input.send_statements,
        log_statement: input.log_statements,
        send_tenant_receipt: input.send_tenant_receipts,
      })
      processed++
    } catch (err) {
      console.error(`Failed to process payout for ${entryId}:`, err)
      failed++
    }
  }

  return { processed, failed }
}

// ============================================================================
// AGENT FEES
// ============================================================================

export async function getAgentFees(companyId: string, fromDate?: string, toDate?: string): Promise<{
  management_fees: AgentChargeItem[]
  letting_fees: AgentChargeItem[]
  contractor_commissions: AgentChargeItem[]
  ad_hoc_charges: AgentChargeItem[]
  grand_total: number
}> {
  // Get all included charges, optionally filtered by date
  let query = supabase
    .from('agent_charges')
    .select('*')
    .eq('company_id', companyId)
    .eq('included', true)
    .order('created_at', { ascending: false })

  if (fromDate) query = query.gte('created_at', `${fromDate}T00:00:00`)
  if (toDate) query = query.lte('created_at', `${toDate}T23:59:59`)

  const { data: charges } = await query

  const mapped = (charges || []).map(c => ({
    id: c.id,
    charge_type: c.charge_type,
    description: c.description,
    net_amount: parseFloat(c.net_amount),
    vat_amount: parseFloat(c.vat_amount),
    gross_amount: parseFloat(c.gross_amount),
    included: c.included,
    contractor_invoice_id: c.contractor_invoice_id,
  }))

  const management_fees = mapped.filter(c => c.charge_type === 'management_fee')
  const letting_fees = mapped.filter(c => c.charge_type === 'letting_fee')
  const contractor_commissions = mapped.filter(c => c.charge_type === 'contractor_commission')
  const ad_hoc_charges = mapped.filter(c => c.charge_type === 'ad_hoc')
  const grand_total = mapped.reduce((sum, c) => sum + c.gross_amount, 0)

  return { management_fees, letting_fees, contractor_commissions, ad_hoc_charges, grand_total }
}

// ============================================================================
// ARREARS
// ============================================================================

export async function getArrears(companyId: string): Promise<any[]> {
  const { data: chases } = await supabase
    .from('arrears_chases')
    .select('*')
    .eq('company_id', companyId)
    .eq('status', 'active')
    .order('created_at', { ascending: true })

  if (!chases || chases.length === 0) return []

  // Enrich with schedule entry data
  const entryIds = chases.map(c => c.schedule_entry_id)
  const { data: entries } = await supabase
    .from('rent_schedule_entries')
    .select('id, tenancy_id, due_date, amount_due, period_start, period_end')
    .in('id', entryIds)

  const tenancyIds = [...new Set((entries || []).map(e => e.tenancy_id))]
  const { data: tenancies } = await supabase
    .from('tenancies')
    .select('id, property_id')
    .in('id', tenancyIds)

  const propertyIds = [...new Set((tenancies || []).map(t => t.property_id).filter(Boolean))]
  const { data: properties } = await supabase
    .from('properties')
    .select('id, address_line1_encrypted, postcode')
    .in('id', propertyIds)

  // Get tenant details for arrears
  const tenantIds = chases.map(c => c.tenant_id).filter(Boolean)
  const { data: tenants } = tenantIds.length > 0
    ? await supabase.from('tenancy_tenants').select('id, first_name_encrypted, last_name_encrypted, guarantor_reference_id').in('id', tenantIds)
    : { data: [] }

  const entryMap = new Map((entries || []).map(e => [e.id, e]))
  const tenancyMap = new Map((tenancies || []).map(t => [t.id, t]))
  const propertyMap = new Map((properties || []).map(p => [p.id, p]))
  const tenantMap = new Map((tenants || []).map(t => [t.id, t]))

  return chases.map(chase => {
    const entry = entryMap.get(chase.schedule_entry_id)
    const tenancy = entry ? tenancyMap.get(entry.tenancy_id) : null
    const property = tenancy ? propertyMap.get(tenancy.property_id) : null
    const tenant = chase.tenant_id ? tenantMap.get(chase.tenant_id) : null

    const today = new Date()
    const dueDate = entry ? new Date(entry.due_date) : today
    const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))

    return {
      id: chase.id,
      schedule_entry_id: chase.schedule_entry_id,
      property_address: property ? decrypt(property.address_line1_encrypted) || '' : '',
      property_postcode: property?.postcode || '',
      tenant_name: tenant
        ? `${decrypt(tenant.first_name_encrypted) || ''} ${decrypt(tenant.last_name_encrypted) || ''}`.trim()
        : 'Unknown',
      has_guarantor: tenant?.guarantor_reference_id ? true : false,
      due_date: entry?.due_date || '',
      amount_outstanding: parseFloat(chase.amount_outstanding),
      partial_paid: parseFloat(chase.partial_paid),
      days_overdue: daysOverdue,
      day7_sent: !!chase.day7_sent_at,
      day14_sent: !!chase.day14_sent_at,
      day21_sent: !!chase.day21_sent_at,
      day28_sent: !!chase.day28_sent_at,
      status: chase.status,
    }
  })
}

export async function resolveArrears(id: string, companyId: string): Promise<void> {
  await supabase
    .from('arrears_chases')
    .update({
      status: 'resolved',
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('company_id', companyId)
}

// ============================================================================
// CLIENT ACCOUNT
// ============================================================================

export async function getCurrentBalance(companyId: string): Promise<number> {
  const { data } = await supabase
    .from('client_account_entries')
    .select('balance_after')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return data ? parseFloat(data.balance_after) : 0
}

export async function getClientAccount(companyId: string, filters?: {
  entry_type?: string
  date_from?: string
  date_to?: string
  property_id?: string
}): Promise<{ entries: any[]; current_balance: number }> {
  let query = supabase
    .from('client_account_entries')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  if (filters?.entry_type) query = query.eq('entry_type', filters.entry_type)
  if (filters?.date_from) query = query.gte('created_at', filters.date_from)
  if (filters?.date_to) query = query.lte('created_at', filters.date_to)

  const { data: entries, error } = await query
  if (error) throw error

  const current_balance = await getCurrentBalance(companyId)

  return {
    entries: (entries || []).map(e => ({
      ...e,
      amount: parseFloat(e.amount),
      balance_after: parseFloat(e.balance_after),
    })),
    current_balance,
  }
}

export async function addManualEntry(companyId: string, input: {
  entry_type: 'manual_credit' | 'manual_debit'
  amount: number
  description: string
  reference?: string
  created_by?: string
}): Promise<any> {
  const currentBalance = await getCurrentBalance(companyId)
  const newBalance = input.entry_type === 'manual_credit'
    ? currentBalance + input.amount
    : currentBalance - input.amount

  const { data, error } = await supabase
    .from('client_account_entries')
    .insert({
      company_id: companyId,
      entry_type: input.entry_type,
      amount: input.amount,
      description: input.description,
      reference: input.reference || null,
      balance_after: newBalance,
      created_by: input.created_by || null,
      is_manual: true,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function recordReconciliation(companyId: string, input: {
  bank_balance: number
  date: string
  created_by?: string
}): Promise<{ matches: boolean; variance: number }> {
  const currentBalance = await getCurrentBalance(companyId)
  const variance = input.bank_balance - currentBalance
  const matches = Math.abs(variance) < 0.01

  await supabase.from('client_account_entries').insert({
    company_id: companyId,
    entry_type: 'reconciliation_checkpoint',
    amount: input.bank_balance,
    description: `Reconciliation checkpoint: bank balance £${input.bank_balance.toFixed(2)} on ${input.date}. ${matches ? 'Matched.' : `Variance: £${variance.toFixed(2)}`}`,
    balance_after: currentBalance,
    created_by: input.created_by || null,
    is_manual: false,
  })

  return { matches, variance }
}

// ============================================================================
// CONTRACTOR INVOICES
// ============================================================================

export async function uploadContractorInvoice(companyId: string, input: {
  contractor_id: string
  property_id?: string
  tenancy_id?: string
  invoice_number: string
  invoice_date: string
  gross_amount: number
  uploaded_by?: string
  pdf_path?: string
}): Promise<any> {
  // Get contractor for commission calc
  const { data: contractor } = await supabase
    .from('contractors')
    .select('commission_percent, commission_vat')
    .eq('id', input.contractor_id)
    .eq('company_id', companyId)
    .single()

  if (!contractor) throw new Error('Contractor not found')

  const commissionPercent = parseFloat(contractor.commission_percent)
  const commissionNet = input.gross_amount * (commissionPercent / 100)
  const commissionVatAmount = contractor.commission_vat ? commissionNet * 0.20 : 0
  const payoutToContractor = input.gross_amount - commissionNet - commissionVatAmount

  const { data, error } = await supabase
    .from('contractor_invoices')
    .insert({
      company_id: companyId,
      contractor_id: input.contractor_id,
      property_id: input.property_id || null,
      tenancy_id: input.tenancy_id || null,
      invoice_number: input.invoice_number,
      invoice_date: input.invoice_date,
      gross_amount: input.gross_amount,
      commission_percent: commissionPercent,
      commission_vat: contractor.commission_vat,
      commission_net: commissionNet,
      commission_vat_amount: commissionVatAmount,
      payout_to_contractor: payoutToContractor,
      status: 'pending',
      uploaded_by: input.uploaded_by || null,
      pdf_path: input.pdf_path || null,
    })
    .select()
    .single()

  if (error) throw error

  // Create an agent_charge against the property's current schedule entry
  // so the invoice gross is deducted from the landlord payout
  if (input.property_id && data) {
    try {
      // Find active tenancy for this property
      const { data: tenancies } = await supabase
        .from('tenancies')
        .select('id')
        .eq('property_id', input.property_id)
        .eq('status', 'active')
        .limit(1)

      if (tenancies && tenancies.length > 0) {
        // Find the latest schedule entry (paid without payout, or due/upcoming)
        const { data: entries } = await supabase
          .from('rent_schedule_entries')
          .select('id, status')
          .eq('tenancy_id', tenancies[0].id)
          .eq('company_id', companyId)
          .in('status', ['paid', 'partial', 'due', 'upcoming', 'overdue'])
          .order('due_date', { ascending: false })
          .limit(1)

        if (entries && entries.length > 0) {
          await supabase.from('agent_charges').insert({
            company_id: companyId,
            schedule_entry_id: entries[0].id,
            charge_type: 'contractor_commission',
            description: `Contractor invoice #${input.invoice_number}`,
            net_amount: input.gross_amount,
            vat_amount: 0,
            gross_amount: input.gross_amount,
            included: true,
            contractor_invoice_id: data.id,
          })
        }
      }
    } catch (err) {
      console.error('Failed to create agent_charge for contractor invoice:', err)
    }
  }

  return data
}

export async function markContractorPaid(companyId: string, input: {
  invoice_id: string
  paid_by?: string
}): Promise<any> {
  const { data: invoice } = await supabase
    .from('contractor_invoices')
    .select('*')
    .eq('id', input.invoice_id)
    .eq('company_id', companyId)
    .single()

  if (!invoice) throw new Error('Invoice not found')

  // Update invoice status
  await supabase
    .from('contractor_invoices')
    .update({ status: 'paid', updated_at: new Date().toISOString() })
    .eq('id', input.invoice_id)

  // Find a schedule entry to link to (via the agent_charge if one exists)
  let scheduleEntryId: string | null = null
  const { data: linkedCharge } = await supabase
    .from('agent_charges')
    .select('schedule_entry_id')
    .eq('contractor_invoice_id', input.invoice_id)
    .limit(1)
  if (linkedCharge && linkedCharge.length > 0) {
    scheduleEntryId = linkedCharge[0].schedule_entry_id
  }

  // If no linked charge, find the latest schedule entry for this property
  if (!scheduleEntryId && invoice.property_id) {
    const { data: tenancies } = await supabase
      .from('tenancies').select('id').eq('property_id', invoice.property_id).eq('status', 'active').limit(1)
    if (tenancies && tenancies.length > 0) {
      const { data: entries } = await supabase
        .from('rent_schedule_entries').select('id').eq('tenancy_id', tenancies[0].id)
        .eq('company_id', companyId).order('due_date', { ascending: false }).limit(1)
      if (entries && entries.length > 0) scheduleEntryId = entries[0].id
    }
  }

  // Create payout record
  let payoutRecord: any = null
  if (scheduleEntryId) {
    const { data } = await supabase
      .from('payout_records')
      .insert({
        company_id: companyId,
        schedule_entry_id: scheduleEntryId,
        contractor_id: invoice.contractor_id,
        payout_type: 'contractor',
        gross_rent: parseFloat(invoice.gross_amount),
        total_charges: parseFloat(invoice.commission_net) + parseFloat(invoice.commission_vat_amount),
        net_payout: parseFloat(invoice.payout_to_contractor),
        paid_by: input.paid_by || null,
      })
      .select()
      .single()
    payoutRecord = data
  }

  // Create ClientAccountEntry
  const currentBalance = await getCurrentBalance(companyId)
  const newBalance = currentBalance - parseFloat(invoice.payout_to_contractor)

  await supabase.from('client_account_entries').insert({
    company_id: companyId,
    entry_type: 'contractor_payout_out',
    amount: parseFloat(invoice.payout_to_contractor),
    description: `Contractor payout: Invoice ${invoice.invoice_number}`,
    related_id: payoutRecord?.id || null,
    related_type: 'payout_record',
    balance_after: newBalance,
    created_by: input.paid_by || null,
    is_manual: false,
  })

  return payoutRecord
}

// ============================================================================
// HANDLE TENANCY NOTICE
// ============================================================================

export async function handleNotice(tenancyId: string, vacateDate: string, companyId: string): Promise<void> {
  const vacateDateObj = new Date(vacateDate)

  // Cancel all future entries beyond vacate date
  const { data: futureEntries } = await supabase
    .from('rent_schedule_entries')
    .select('id, period_start, period_end, amount_due')
    .eq('tenancy_id', tenancyId)
    .gt('period_start', vacateDate)
    .neq('status', 'cancelled')

  if (futureEntries && futureEntries.length > 0) {
    await supabase
      .from('rent_schedule_entries')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .in('id', futureEntries.map(e => e.id))
  }

  // Pro-rata the final period if vacate date is mid-period
  const { data: currentEntry } = await supabase
    .from('rent_schedule_entries')
    .select('*')
    .eq('tenancy_id', tenancyId)
    .lte('period_start', vacateDate)
    .gte('period_end', vacateDate)
    .neq('status', 'cancelled')
    .single()

  if (currentEntry) {
    const periodStart = new Date(currentEntry.period_start)
    const periodEnd = new Date(currentEntry.period_end)
    const totalDays = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
    const daysRemaining = Math.ceil((vacateDateObj.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)) + 1

    if (daysRemaining < totalDays) {
      const proRataAmount = (daysRemaining / totalDays) * parseFloat(currentEntry.amount_due)

      await supabase
        .from('rent_schedule_entries')
        .update({
          amount_due: Math.round(proRataAmount * 100) / 100,
          period_end: vacateDate,
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentEntry.id)
    }
  }
}

// ============================================================================
// LANDLORD STATEMENTS
// ============================================================================

export async function getLandlordStatements(landlordId: string, companyId: string): Promise<any[]> {
  const { data } = await supabase
    .from('payout_records')
    .select('*')
    .eq('landlord_id', landlordId)
    .eq('company_id', companyId)
    .eq('payout_type', 'landlord')
    .order('paid_at', { ascending: false })

  return (data || []).map(r => ({
    id: r.id,
    paid_at: r.paid_at,
    gross_rent: parseFloat(r.gross_rent),
    total_charges: parseFloat(r.total_charges),
    net_payout: parseFloat(r.net_payout),
    statement_pdf_path: r.statement_pdf_path,
    statement_sent_at: r.statement_sent_at,
  }))
}

// ============================================================================
// TENANT RECEIPT EMAIL
// ============================================================================

async function sendTenantReceipt(companyId: string, scheduleEntryId: string): Promise<void> {
  const { data: entry } = await supabase
    .from('rent_schedule_entries')
    .select('tenancy_id, amount_received, period_start, period_end, due_date')
    .eq('id', scheduleEntryId)
    .single()

  if (!entry) return

  const { data: tenancy } = await supabase
    .from('tenancies')
    .select('property_id, rent_amount, monthly_rent, rent_due_day')
    .eq('id', entry.tenancy_id)
    .single()

  if (!tenancy) return

  const { data: property } = await supabase
    .from('properties')
    .select('address_line1_encrypted, postcode')
    .eq('id', tenancy.property_id)
    .single()

  const { data: company } = await supabase
    .from('companies')
    .select('name_encrypted, logo_url')
    .eq('id', companyId)
    .single()
  const companyName = (company?.name_encrypted ? decrypt(company.name_encrypted) : null) || 'PropertyGoose'
  const companyLogo = company?.logo_url || ''

  const { data: tenants } = await supabase
    .from('tenancy_tenants')
    .select('tenant_name_encrypted, tenant_email_encrypted, status')
    .eq('tenancy_id', entry.tenancy_id)

  // Filter active tenants (status may not exist on all rows)
  const activeTenants = (tenants || []).filter(t => !t.status || t.status === 'active')
  if (activeTenants.length === 0) return

  const propertyAddress = property
    ? `${decrypt(property.address_line1_encrypted) || ''}, ${property.postcode || ''}`
    : 'your property'
  const nextRent = parseFloat(tenancy.rent_amount || tenancy.monthly_rent || 0)

  // Calculate next due date
  const currentDue = new Date(entry.due_date)
  const nextDueDate = new Date(currentDue)
  nextDueDate.setMonth(nextDueDate.getMonth() + 1)

  for (const tenant of activeTenants) {
    const email = decrypt(tenant.tenant_email_encrypted)
    if (!email) continue

    const tenantName = decrypt(tenant.tenant_name_encrypted) || 'Tenant'

    try {
      const { sendEmail, loadEmailTemplate } = await import('./emailService')
      const html = loadEmailTemplate('tenant-rent-receipt', {
        TenantName: tenantName,
        Amount: parseFloat(entry.amount_received).toFixed(2),
        DateReceived: new Date().toLocaleDateString('en-GB'),
        PropertyAddress: propertyAddress,
        NextAmount: nextRent.toFixed(2),
        NextDueDate: nextDueDate.toLocaleDateString('en-GB'),
        CompanyName: companyName,
        AgentLogoUrl: companyLogo,
      })

      await sendEmail({
        to: email,
        subject: `Payment Receipt - ${propertyAddress}`,
        html,
        companyId,
        emailCategory: 'tenant_receipt',
      })
    } catch (err) {
      console.error(`Failed to send tenant receipt to ${email}:`, err)
    }
  }
}

// ============================================================================
// STATUS UPDATE CRON
// ============================================================================

export async function updateScheduleStatuses(): Promise<void> {
  const today = new Date().toISOString().split('T')[0]

  // Mark 'upcoming' as 'due' if due_date = today
  await supabase
    .from('rent_schedule_entries')
    .update({ status: 'due', updated_at: new Date().toISOString() })
    .eq('status', 'upcoming')
    .eq('due_date', today)

  // Mark 'due' as 'overdue' if due_date < today
  await supabase
    .from('rent_schedule_entries')
    .update({ status: 'overdue', updated_at: new Date().toISOString() })
    .eq('status', 'due')
    .lt('due_date', today)
}
