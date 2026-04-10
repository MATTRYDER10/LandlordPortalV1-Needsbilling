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
  paid_at?: string
  payout_sent_at?: string
  total_charges?: number
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
  rent_credit_amount?: number
  rent_credit_reason?: string
  original_amount_due?: number
  has_rlp?: boolean
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
  ownership_percentage: number
  rent_hold_active?: boolean
  rent_hold_note?: string
  tenant_names: string
  tenancy_ref: string
  period_start: string
  period_end: string
  gross_rent: number
  charges: AgentChargeItem[]
  total_charges: number
  net_payout: number
  deposit_amount: number
  deposit_expected_payment_id?: string
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
  // SAFETY: skip entirely if this company isn't on the RentGoose whitelist.
  // Otherwise we'd silently create rent_schedule_entries that the arrears
  // scheduler would later process — sending arrears emails to tenants whose
  // agent never opted into RentGoose.
  const { isRentGooseEnabled } = await import('./rentgooseAccess')
  if (!await isRentGooseEnabled(companyId)) {
    console.log(`[RentGoose] Skipping initTenancySchedule for tenancy ${tenancyId} — company not RentGoose-enabled`)
    return
  }

  // Get tenancy details — management_type on tenancy is the single source of truth
  const { data: tenancy, error: tenancyErr } = await supabase
    .from('tenancies')
    .select('id, tenancy_start_date, rent_amount, monthly_rent, rent_due_day, status, property_id, management_type, additional_charges')
    .eq('id', tenancyId)
    .single()

  if (tenancyErr || !tenancy) {
    console.error('Failed to get tenancy for schedule init:', tenancyErr)
    return
  }

  // management_type on the tenancy gates RentGoose entry — must be explicitly set
  // If null, fall back to property for backwards compat
  let managementType = tenancy.management_type
  let propertyFees: { fee_percent: number | null; management_fee_type: string | null; letting_fee_amount: number | null; letting_fee_type: string | null } = {
    fee_percent: null,
    management_fee_type: null,
    letting_fee_amount: null,
    letting_fee_type: null,
  }
  if (tenancy.property_id) {
    const { data: prop } = await supabase
      .from('properties')
      .select('management_type, fee_percent, management_fee_type, letting_fee_amount, letting_fee_type')
      .eq('id', tenancy.property_id)
      .single()
    if (!managementType) managementType = prop?.management_type || null
    if (prop) {
      propertyFees = {
        fee_percent: prop.fee_percent != null ? parseFloat(prop.fee_percent) : null,
        management_fee_type: prop.management_fee_type || null,
        letting_fee_amount: prop.letting_fee_amount != null ? parseFloat(prop.letting_fee_amount) : null,
        letting_fee_type: prop.letting_fee_type || null,
      }
    }
  }

  if (!managementType) {
    console.log(`[RentGoose] Skipping tenancy ${tenancyId} — no management type set`)
    return
  }

  const isLetOnly = managementType === 'let_only'

  const monthlyRent = parseFloat(tenancy.rent_amount || tenancy.monthly_rent || 0)
  const rentDueDay = tenancy.rent_due_day || 1
  const startDate = new Date(tenancy.tenancy_start_date)
  startDate.setHours(0, 0, 0, 0)

  // Check if schedule already exists
  const { count } = await supabase
    .from('rent_schedule_entries')
    .select('id', { count: 'exact', head: true })
    .eq('tenancy_id', tenancyId)
    .neq('status', 'cancelled')

  if (count && count > 0) return // Already initialised

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Generate current month + next month (or start month + following if tenancy starts in future)
  const firstMonth = startDate > today
    ? new Date(startDate.getFullYear(), startDate.getMonth(), 1)
    : new Date(today.getFullYear(), today.getMonth(), 1)

  // Let only: month 1 only (initial monies + first rent). Managed: current + next month.
  const monthsToGenerate = isLetOnly
    ? [firstMonth]
    : [firstMonth, new Date(firstMonth.getFullYear(), firstMonth.getMonth() + 1, 1)]

  const entries: any[] = []

  for (const monthStart of monthsToGenerate) {
    const periodEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0)
    const dueDate = new Date(monthStart.getFullYear(), monthStart.getMonth(), rentDueDay)
    if (dueDate < monthStart) dueDate.setMonth(dueDate.getMonth() + 1)

    const dueDateOnly = new Date(dueDate)
    dueDateOnly.setHours(0, 0, 0, 0)

    let status = 'upcoming'
    if (dueDateOnly.getTime() === today.getTime()) status = 'due'
    else if (dueDateOnly < today) status = 'overdue'

    entries.push({
      company_id: companyId,
      tenancy_id: tenancyId,
      period_start: monthStart.toISOString().split('T')[0],
      period_end: periodEnd.toISOString().split('T')[0],
      amount_due: monthlyRent,
      amount_received: 0,
      status,
      due_date: dueDate.toISOString().split('T')[0],
    })
  }

  let month1EntryId: string | null = null

  if (entries.length > 0) {
    const { data: insertedEntries, error } = await supabase
      .from('rent_schedule_entries')
      .insert(entries)
      .select('id, period_start')

    if (error) {
      console.error('Failed to create rent schedule:', error)
    } else if (insertedEntries && insertedEntries.length > 0) {
      // Identify month 1 (earliest period) for new-tenancy charges
      const sorted = [...insertedEntries].sort((a, b) => a.period_start.localeCompare(b.period_start))
      month1EntryId = sorted[0].id
    }
  }

  // Create month 1 agent charges: management fee, letting/setup fee, additional one-off charges
  // These are the deductions taken from the first month's rent on a new tenancy.
  if (month1EntryId) {
    const month1Charges: any[] = []

    // Management fee (recurring — applied every month, but we create it on month 1 here;
    // getPayoutsQueue auto-creates for subsequent months if missing)
    if (propertyFees.fee_percent && propertyFees.fee_percent > 0) {
      let netFee: number
      if (propertyFees.management_fee_type === 'fixed') {
        netFee = propertyFees.fee_percent
      } else {
        netFee = Math.round((propertyFees.fee_percent / 100) * monthlyRent * 100) / 100
      }
      const vatFee = Math.round(netFee * 0.20 * 100) / 100
      month1Charges.push({
        company_id: companyId,
        schedule_entry_id: month1EntryId,
        charge_type: 'management_fee',
        description: propertyFees.management_fee_type === 'fixed'
          ? `Management fee (£${netFee.toFixed(2)}/month)`
          : `Management fee at ${propertyFees.fee_percent}%`,
        net_amount: netFee,
        vat_amount: vatFee,
        gross_amount: Math.round((netFee + vatFee) * 100) / 100,
        included: true,
      })
    }

    // Letting/setup fee (one-off, only on month 1)
    if (propertyFees.letting_fee_amount && propertyFees.letting_fee_amount > 0) {
      let netLet: number
      if (propertyFees.letting_fee_type === 'percentage') {
        netLet = Math.round((propertyFees.letting_fee_amount / 100) * monthlyRent * 100) / 100
      } else {
        netLet = propertyFees.letting_fee_amount
      }
      const vatLet = Math.round(netLet * 0.20 * 100) / 100
      month1Charges.push({
        company_id: companyId,
        schedule_entry_id: month1EntryId,
        charge_type: 'letting_fee',
        description: propertyFees.letting_fee_type === 'percentage'
          ? `Letting/setup fee at ${propertyFees.letting_fee_amount}%`
          : `Letting/setup fee (£${propertyFees.letting_fee_amount.toFixed(2)})`,
        net_amount: netLet,
        vat_amount: vatLet,
        gross_amount: Math.round((netLet + vatLet) * 100) / 100,
        included: true,
      })
    }

    // Additional one-off charges from the tenancy (e.g. inventory fee, EPC, admin)
    // These are landlord fees deducted from month 1 rent (not collected from tenant via initial monies).
    const additionalCharges = (tenancy.additional_charges || []) as any[]
    for (const ch of additionalCharges) {
      if (ch.frequency !== 'one_time') continue
      const net = parseFloat(ch.amount) || 0
      if (net <= 0) continue
      const vat = Math.round(net * 0.20 * 100) / 100
      month1Charges.push({
        company_id: companyId,
        schedule_entry_id: month1EntryId,
        charge_type: 'ad_hoc',
        description: ch.name || 'Additional charge',
        net_amount: net,
        vat_amount: vat,
        gross_amount: Math.round((net + vat) * 100) / 100,
        included: true,
      })
    }

    if (month1Charges.length > 0) {
      const { error: chargesErr } = await supabase
        .from('agent_charges')
        .insert(month1Charges)
      if (chargesErr) {
        console.error('[RentGoose] Failed to create month 1 agent_charges:', chargesErr)
      }
    }
  }

  // Create rent share allocations for HMO tenancies
  await initRentShareAllocations(tenancyId, companyId)

  // Auto-receipt month 1 if initial monies already confirmed (non-blocking)
  try {
    await autoReceiptMonth1FromInitialMonies(tenancyId, companyId)
  } catch (err: any) {
    console.error('[RentGoose] Auto-receipt month 1 failed (non-blocking):', err.message)
  }
}

/**
 * Bridges initial monies → month 1 rent schedule entry.
 * If initial monies have been receipted and a month 1 entry exists unpaid,
 * auto-marks it as paid so it moves straight to the payout queue.
 * Idempotent — returns false if nothing to do.
 */
export async function autoReceiptMonth1FromInitialMonies(tenancyId: string, companyId: string): Promise<boolean> {
  // 1. Find paid initial monies expected_payment
  const { data: ep } = await supabase
    .from('expected_payments')
    .select('id, payout_split')
    .eq('tenancy_id', tenancyId)
    .eq('payment_type', 'initial_monies')
    .eq('status', 'paid')
    .limit(1)
    .maybeSingle()

  if (!ep || !ep.payout_split) return false

  // 2. Extract rent portion from payout_split
  const splits = (ep.payout_split as any[]) || []
  const rentSplits = splits.filter((s: any) => s.type === 'landlord_rent' || s.type === 'landlord_prorata')
  const rentPortion = rentSplits.reduce((sum: number, s: any) => sum + parseFloat(s.amount || 0), 0)
  if (rentPortion <= 0) return false

  // 3. Find earliest unpaid month 1 rent_schedule_entry
  const { data: entry } = await supabase
    .from('rent_schedule_entries')
    .select('id, amount_due, amount_received, status')
    .eq('tenancy_id', tenancyId)
    .eq('company_id', companyId)
    .not('status', 'in', '("paid","cancelled")')
    .order('period_start', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!entry) return false

  // 4. Mark the entry as paid
  const amountDue = parseFloat(entry.amount_due)
  const receiptAmount = Math.min(rentPortion, amountDue)

  const { error: updateErr } = await supabase
    .from('rent_schedule_entries')
    .update({
      amount_received: receiptAmount,
      status: receiptAmount >= amountDue ? 'paid' : 'partial',
    })
    .eq('id', entry.id)

  if (updateErr) {
    console.error('[RentGoose] Failed to auto-receipt month 1:', updateErr)
    return false
  }

  // 5. Create rent_payments record (no client_account_entry — money already posted)
  await supabase
    .from('rent_payments')
    .insert({
      company_id: companyId,
      schedule_entry_id: entry.id,
      amount: receiptAmount,
      payment_method: 'initial_monies',
      date_received: new Date().toISOString().split('T')[0],
      reference: `Auto-receipted from initial monies (EP: ${ep.id.slice(0, 8)})`,
    })

  console.log(`[RentGoose] Auto-receipted month 1 for tenancy ${tenancyId}: £${receiptAmount}`)
  return true
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
    .select('rent_amount, monthly_rent, rent_due_day')
    .eq('id', tenancyId)
    .single()

  if (!tenancy) return

  // Get latest non-cancelled entry
  const { data: latest } = await supabase
    .from('rent_schedule_entries')
    .select('period_start, period_end')
    .eq('tenancy_id', tenancyId)
    .neq('status', 'cancelled')
    .order('period_end', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!latest) return

  // Only need next month covered — check if it already exists
  const today = new Date()
  const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1)
  const latestPeriodStart = new Date(latest.period_start)

  // Already covers next month or beyond
  if (latestPeriodStart >= nextMonthStart) return

  const monthlyRent = parseFloat(tenancy.rent_amount || tenancy.monthly_rent || 0)
  const rentDueDay = tenancy.rent_due_day || 1

  const periodEnd = new Date(nextMonthStart.getFullYear(), nextMonthStart.getMonth() + 1, 0)
  const dueDate = new Date(nextMonthStart.getFullYear(), nextMonthStart.getMonth(), rentDueDay)
  if (dueDate < nextMonthStart) dueDate.setMonth(dueDate.getMonth() + 1)

  await supabase.from('rent_schedule_entries').insert({
    company_id: companyId,
    tenancy_id: tenancyId,
    period_start: nextMonthStart.toISOString().split('T')[0],
    period_end: periodEnd.toISOString().split('T')[0],
    amount_due: monthlyRent,
    amount_received: 0,
    status: 'upcoming',
    due_date: dueDate.toISOString().split('T')[0],
  })
}

// ============================================================================
// SYNC ACTIVE MANAGED TENANCIES
// ============================================================================

export async function syncActiveManagedTenancies(companyId: string): Promise<{ synced: number; extended: number }> {
  // SAFETY: skip entirely if this company isn't on the RentGoose whitelist.
  const { isRentGooseEnabled } = await import('./rentgooseAccess')
  if (!await isRentGooseEnabled(companyId)) return { synced: 0, extended: 0 }

  // Get all active tenancies with management_type — tenancy is the source of truth
  const { data: allTenancies, error } = await supabase
    .from('tenancies')
    .select('id, tenancy_start_date, rent_amount, monthly_rent, rent_due_day, property_id, management_type')
    .eq('company_id', companyId)
    .eq('status', 'active')
    .is('deleted_at', null)

  if (error || !allTenancies || allTenancies.length === 0) return { synced: 0, extended: 0 }

  // Only extend rolling schedules for managed tenancies — let_only gets month 1 only via initTenancySchedule
  const tenancies = allTenancies.filter(t => {
    if (!t.management_type) return false // No management type set = not in RentGoose
    if (t.management_type === 'let_only') return false // No recurring for let_only
    return true
  })
  if (tenancies.length === 0) return { synced: 0, extended: 0 }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // The two months we always want covered: current month + next month
  const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1)
  const targetMonths = [currentMonthStart, nextMonthStart]

  const tenancyIds = tenancies.map(t => t.id)

  // Get ALL entries (including cancelled) — cancelled means user removed it on purpose, don't recreate
  const { data: existing } = await supabase
    .from('rent_schedule_entries')
    .select('tenancy_id, period_start')
    .in('tenancy_id', tenancyIds)

  // Index existing entries: tenancyId → Set of 'YYYY-MM' strings
  const coveredMonths = new Map<string, Set<string>>()
  for (const e of (existing || [])) {
    if (!coveredMonths.has(e.tenancy_id)) coveredMonths.set(e.tenancy_id, new Set())
    const d = new Date(e.period_start)
    coveredMonths.get(e.tenancy_id)!.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  let synced = 0
  let extended = 0
  const toInsert: any[] = []

  for (const tenancy of tenancies) {
    const startDate = new Date(tenancy.tenancy_start_date)
    startDate.setHours(0, 0, 0, 0)
    const monthlyRent = parseFloat(tenancy.rent_amount || tenancy.monthly_rent || 0)
    const rentDueDay = tenancy.rent_due_day || 1
    const existing = coveredMonths.get(tenancy.id) || new Set<string>()
    const isNew = existing.size === 0

    for (const monthStart of targetMonths) {
      // Skip months before the tenancy started
      if (monthStart < new Date(startDate.getFullYear(), startDate.getMonth(), 1)) continue

      const key = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`
      if (existing.has(key)) continue // Already covered

      const periodEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0)
      const dueDate = new Date(monthStart.getFullYear(), monthStart.getMonth(), rentDueDay)
      if (dueDate < monthStart) dueDate.setMonth(dueDate.getMonth() + 1)

      const dueDateOnly = new Date(dueDate)
      dueDateOnly.setHours(0, 0, 0, 0)
      let status = 'upcoming'
      if (dueDateOnly.getTime() === today.getTime()) status = 'due'
      else if (dueDateOnly < today) status = 'overdue'

      toInsert.push({
        company_id: companyId,
        tenancy_id: tenancy.id,
        period_start: monthStart.toISOString().split('T')[0],
        period_end: periodEnd.toISOString().split('T')[0],
        amount_due: monthlyRent,
        amount_received: 0,
        status,
        due_date: dueDate.toISOString().split('T')[0],
      })

      if (isNew) { synced++ } else { extended++ }
    }
  }

  if (toInsert.length > 0) {
    await supabase.from('rent_schedule_entries').insert(toInsert)
  }

  // Update statuses (overdue detection)
  await updateScheduleStatuses()

  return { synced, extended }
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
    .select('id, property_id, rent_amount, monthly_rent, has_rlp')
    .in('id', tenancyIds)

  if (!tenancies) return entries

  const propertyIds = [...new Set(tenancies.map(t => t.property_id).filter(Boolean))]

  const { data: properties } = await supabase
    .from('properties')
    .select('id, address_line1_encrypted, postcode, fee_percent, management_type, management_fee_type')
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

    // Skip properties without fee information
    const hasFee = (property.fee_percent && parseFloat(property.fee_percent) > 0) || property.management_fee_type === 'fixed'
    if (!hasFee) continue

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
      rent_credit_amount: entry.rent_credit_amount ? parseFloat(entry.rent_credit_amount) : undefined,
      rent_credit_reason: entry.rent_credit_reason || undefined,
      original_amount_due: entry.original_amount_due ? parseFloat(entry.original_amount_due) : undefined,
      has_rlp: tenancy.has_rlp || false,
    })
  }

  // Apply computed status filter if requested
  if (filters.status && filters.status !== 'all' && filters.status !== 'partial' && filters.status !== 'paid') {
    return enriched.filter(e => e.status === filters.status)
  }

  return enriched
}

// ============================================================================
// APPLY RENT CREDIT
// ============================================================================

export async function applyRentCredit(companyId: string, input: {
  schedule_entry_id: string
  credit_amount: number
  reason: string
  applied_by?: string
}): Promise<{ success: boolean; new_amount_due: number }> {
  const { data: entry, error: entryErr } = await supabase
    .from('rent_schedule_entries')
    .select('*')
    .eq('id', input.schedule_entry_id)
    .eq('company_id', companyId)
    .single()

  if (entryErr || !entry) throw new Error('Schedule entry not found')

  const currentAmountDue = parseFloat(entry.amount_due)
  const originalAmount = entry.original_amount_due ? parseFloat(entry.original_amount_due) : currentAmountDue
  const existingCredit = parseFloat(entry.rent_credit_amount || 0)
  const newCreditTotal = existingCredit + input.credit_amount
  const newAmountDue = Math.max(0, originalAmount - newCreditTotal)

  const { error: updateErr } = await supabase
    .from('rent_schedule_entries')
    .update({
      amount_due: newAmountDue,
      rent_credit_amount: newCreditTotal,
      rent_credit_reason: input.reason,
      original_amount_due: originalAmount,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.schedule_entry_id)

  if (updateErr) throw updateErr

  return { success: true, new_amount_due: newAmountDue }
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

  // Check which already have payout records (track per entry+landlord pair for split landlords)
  const entryIds = entries.map(e => e.id)
  const { data: existingPayouts } = await supabase
    .from('payout_records')
    .select('schedule_entry_id, landlord_id')
    .in('schedule_entry_id', entryIds)
    .eq('payout_type', 'landlord')

  const paidOutPairs = new Set((existingPayouts || []).map(p => `${p.schedule_entry_id}:${p.landlord_id || ''}`))

  if (entries.length === 0) return []

  // Enrich with tenancy/property/landlord data
  const tenancyIds = [...new Set(entries.map(e => e.tenancy_id))]
  const { data: tenancies } = await supabase
    .from('tenancies')
    .select('id, property_id, deposit_scheme')
    .in('id', tenancyIds)

  // Batch-fetch landlord-held deposits not yet paid out to landlord
  const landlordHeldTenancyIds = (tenancies || [])
    .filter(t => t.deposit_scheme === 'landlord_held')
    .map(t => t.id)

  const depositByTenancy = new Map<string, { amount: number; expected_payment_id: string }>()
  if (landlordHeldTenancyIds.length > 0) {
    const { data: depositEPs } = await supabase
      .from('expected_payments')
      .select('id, tenancy_id, payout_split')
      .in('tenancy_id', landlordHeldTenancyIds)
      .eq('status', 'paid')
      .is('deposit_payout_at', null)

    for (const ep of (depositEPs || [])) {
      const splits: any[] = ep.payout_split || []
      const depositSplit = splits.find((s: any) => s.type === 'deposit_hold')
      if (depositSplit && parseFloat(depositSplit.amount) > 0) {
        depositByTenancy.set(ep.tenancy_id, {
          amount: parseFloat(depositSplit.amount),
          expected_payment_id: ep.id,
        })
      }
    }
  }

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
    .select('property_id, landlord_id, ownership_percentage')
    .in('property_id', propertyIds)

  const landlordIds = [...new Set((propertyLandlords || []).map(pl => pl.landlord_id))]
  const { data: landlords } = landlordIds.length > 0
    ? await supabase.from('landlords').select('id, first_name_encrypted, last_name_encrypted, email_encrypted, bank_account_name_encrypted, bank_account_number_encrypted, bank_sort_code_encrypted, rent_hold_active, rent_hold_note').in('id', landlordIds)
    : { data: [] }

  const { data: tenancyTenants } = await supabase
    .from('tenancy_tenants')
    .select('tenancy_id, tenant_name_encrypted, status')
    .in('tenancy_id', tenancyIds)

  // Get charges for these entries
  const { data: allCharges } = await supabase
    .from('agent_charges')
    .select('*')
    .in('schedule_entry_id', entries.map(e => e.id))

  // Build lookups
  const tenancyMap = new Map((tenancies || []).map(t => [t.id, t]))
  const propertyMap = new Map((properties || []).map(p => [p.id, p]))
  const landlordMap = new Map((landlords || []).map(l => [l.id, l]))
  // Map property_id → array of { landlord_id, ownership_percentage }
  const propertyLandlordsMap = new Map<string, Array<{ landlord_id: string; ownership_percentage: number }>>()
  for (const pl of (propertyLandlords || [])) {
    const existing = propertyLandlordsMap.get(pl.property_id) || []
    existing.push({ landlord_id: pl.landlord_id, ownership_percentage: parseFloat(pl.ownership_percentage) || 100 })
    propertyLandlordsMap.set(pl.property_id, existing)
  }
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

  // Pre-filter: only keep entries that have at least one unpaid landlord split
  const unpaidEntries = entries.filter(entry => {
    const tenancy = tenancyMap.get(entry.tenancy_id)
    if (!tenancy) return false
    const propLandlords = propertyLandlordsMap.get(tenancy.property_id) || []
    const splits = propLandlords.length > 0 ? propLandlords : [{ landlord_id: '', ownership_percentage: 100 }]
    return splits.some(s => !paidOutPairs.has(`${entry.id}:${s.landlord_id || ''}`))
  })

  if (unpaidEntries.length === 0) return []

  const payouts: PayoutItem[] = []
  for (const entry of unpaidEntries) {
    const tenancy = tenancyMap.get(entry.tenancy_id)
    if (!tenancy) continue

    const property = propertyMap.get(tenancy.property_id)
    if (!property) continue

    // Get all landlords for this property (split landlord support)
    const propLandlords = propertyLandlordsMap.get(tenancy.property_id) || []
    // If no landlords linked, create a single payout with unknown landlord
    const landlordSplits = propLandlords.length > 0
      ? propLandlords
      : [{ landlord_id: '', ownership_percentage: 100 }]

    const tenants = tenantsByTenancy.get(entry.tenancy_id) || []
    const fullGrossRent = parseFloat(entry.amount_received)

    // Build charges once (shared across landlord splits — charges are deducted proportionally)
    const fullCharges: AgentChargeItem[] = (chargesByEntry.get(entry.id) || []).map((c: any) => ({
      id: c.id,
      charge_type: c.charge_type,
      description: c.description,
      net_amount: parseFloat(c.net_amount),
      vat_amount: parseFloat(c.vat_amount),
      gross_amount: parseFloat(c.gross_amount),
      included: c.included,
      contractor_invoice_id: c.contractor_invoice_id,
    }))

    const hasExistingCharges = chargesByEntry.has(entry.id)

    if (!hasExistingCharges) {
      if (property.fee_percent) {
        const feePercent = parseFloat(property.fee_percent)
        if (feePercent > 0) {
          let netFee: number
          if (property.management_fee_type === 'fixed') {
            netFee = feePercent
          } else {
            netFee = Math.round((feePercent / 100) * fullGrossRent * 100) / 100
          }
          const vatFee = Math.round(netFee * 0.20 * 100) / 100
          fullCharges.push({
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

      const propCharges = propertyChargesByProperty.get(tenancy.property_id) || []
      for (const pc of propCharges) {
        const amt = parseFloat(pc.amount)
        const vat = pc.is_vatable ? Math.round(amt * 0.20 * 100) / 100 : 0
        fullCharges.push({
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

    const tenantNameStr = tenants
      .filter((t: any) => !t.status || t.status === 'active')
      .map((t: any) => decrypt(t.tenant_name_encrypted) || 'Tenant')
      .join(', ')
    const propertyAddress = decrypt(property.address_line1_encrypted) || ''

    // Create a separate payout per landlord, split by ownership_percentage
    for (const split of landlordSplits) {
      // Skip if this entry+landlord pair already paid
      if (split.landlord_id && paidOutPairs.has(`${entry.id}:${split.landlord_id}`)) continue

      const pct = split.ownership_percentage / 100
      const landlord = split.landlord_id ? landlordMap.get(split.landlord_id) : null
      const grossRent = Math.round(fullGrossRent * pct * 100) / 100

      // Split charges proportionally
      const charges: AgentChargeItem[] = fullCharges.map(c => ({
        ...c,
        net_amount: Math.round(c.net_amount * pct * 100) / 100,
        vat_amount: Math.round(c.vat_amount * pct * 100) / 100,
        gross_amount: Math.round(c.gross_amount * pct * 100) / 100,
      }))

      const includedCharges = charges.filter((c: AgentChargeItem) => c.included)
      const totalCharges = includedCharges.reduce((sum: number, c: AgentChargeItem) => sum + c.gross_amount, 0)
      // Cap at 0 — if fees exceed rent, the deficit carries over to next month (handled at payout time)
      const netPayout = Math.max(0, Math.round((grossRent - totalCharges) * 100) / 100)

      const landlordName = landlord
        ? `${decrypt(landlord.first_name_encrypted) || ''} ${decrypt(landlord.last_name_encrypted) || ''}`.trim()
        : 'Unknown'

      const statementRef = `RG-${Date.now().toString(36).toUpperCase()}-${entry.id.substring(0, 4).toUpperCase()}`

      // Deposit: only include on the primary landlord split (highest ownership %) to avoid double-paying
      const isPrimaryLandlord = split.ownership_percentage >= Math.max(...landlordSplits.map(s => s.ownership_percentage))
      const depositInfo = isPrimaryLandlord ? depositByTenancy.get(entry.tenancy_id) : undefined
      const depositAmount = depositInfo ? Math.round(depositInfo.amount * pct * 100) / 100 : 0

      payouts.push({
        id: split.landlord_id ? `${entry.id}:${split.landlord_id}` : entry.id,
        schedule_entry_id: entry.id,
        property_id: tenancy.property_id,
        property_address: propertyAddress,
        property_postcode: property.postcode || '',
        landlord_name: landlordName,
        landlord_id: split.landlord_id || '',
        landlord_email: landlord ? decrypt(landlord.email_encrypted) || undefined : undefined,
        landlord_bank_name: landlord?.bank_account_name_encrypted ? decrypt(landlord.bank_account_name_encrypted) || undefined : undefined,
        landlord_bank_account_last4: landlord?.bank_account_number_encrypted
          ? (decrypt(landlord.bank_account_number_encrypted) || '').slice(-4) || undefined
          : undefined,
        landlord_bank_sort_code: landlord?.bank_sort_code_encrypted ? decrypt(landlord.bank_sort_code_encrypted) || undefined : undefined,
        ownership_percentage: split.ownership_percentage,
        rent_hold_active: landlord?.rent_hold_active || false,
        rent_hold_note: landlord?.rent_hold_note || undefined,
        tenant_names: tenantNameStr,
        tenancy_ref: entry.tenancy_id.substring(0, 8).toUpperCase(),
        period_start: entry.period_start,
        period_end: entry.period_end,
        gross_rent: grossRent,
        charges,
        total_charges: totalCharges,
        net_payout: netPayout,
        deposit_amount: depositAmount,
        deposit_expected_payment_id: depositInfo?.expected_payment_id,
        statement_ref: statementRef,
      })
    }
  }

  return payouts
}

// ============================================================================
// MARK PAYOUT PAID
// ============================================================================

/**
 * If month X's rent doesn't cover all the agent fees, the deficit carries over to
 * month X+1 by creating a `carryover` agent_charge on the next rent entry.
 * Idempotent — won't create a duplicate carryover for the same source entry.
 */
async function applyFeeCarryover(companyId: string, scheduleEntryId: string, grossRent: number, totalCharges: number): Promise<void> {
  const deficit = Math.round((totalCharges - grossRent) * 100) / 100
  if (deficit <= 0) return

  // Find this entry's tenancy + period
  const { data: thisEntry } = await supabase
    .from('rent_schedule_entries')
    .select('tenancy_id, period_start')
    .eq('id', scheduleEntryId)
    .maybeSingle()
  if (!thisEntry) return

  // Find the next non-cancelled rent entry for this tenancy
  const { data: nextEntry } = await supabase
    .from('rent_schedule_entries')
    .select('id, period_start')
    .eq('tenancy_id', thisEntry.tenancy_id)
    .eq('company_id', companyId)
    .gt('period_start', thisEntry.period_start)
    .neq('status', 'cancelled')
    .order('period_start', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!nextEntry) {
    console.log(`[RentGoose] No next entry to carry over £${deficit} fee deficit from ${scheduleEntryId}`)
    return
  }

  // Idempotency: skip if a carryover from this source already exists
  const carryRef = `CARRY-${scheduleEntryId.slice(0, 8)}`
  const { data: existing } = await supabase
    .from('agent_charges')
    .select('id')
    .eq('schedule_entry_id', nextEntry.id)
    .eq('charge_type', 'carryover')
    .ilike('description', `%${carryRef}%`)
    .limit(1)
    .maybeSingle()
  if (existing) return

  await supabase.from('agent_charges').insert({
    company_id: companyId,
    schedule_entry_id: nextEntry.id,
    charge_type: 'carryover',
    description: `Fees carried over from previous rent (${carryRef})`,
    net_amount: deficit,
    vat_amount: 0,
    gross_amount: deficit,
    included: true,
  })

  console.log(`[RentGoose] Carried over £${deficit} fee deficit from entry ${scheduleEntryId} → ${nextEntry.id}`)
}

export async function markPayoutPaid(companyId: string, input: {
  schedule_entry_id: string
  landlord_id?: string
  paid_by?: string
  send_statement: boolean
  log_statement: boolean
  send_tenant_receipt: boolean
}): Promise<{ payout_id: string }> {
  // Get entry and related data
  const payouts = await getPayoutsQueue(companyId)
  const payout = payouts.find(p => {
    if (p.schedule_entry_id !== input.schedule_entry_id) return false
    // For split landlords, match by landlord_id; for single/unknown landlord, match first
    if (input.landlord_id !== undefined && input.landlord_id !== '') {
      return p.landlord_id === input.landlord_id
    }
    return true
  })
  if (!payout) throw new Error('Payout not found in queue')

  // Create payout record (synchronous — must succeed before returning)
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
      deposit_amount: payout.deposit_amount || 0,
      paid_by: input.paid_by || null,
    })
    .select()
    .single()

  if (payoutErr) throw payoutErr

  // If charges exceeded rent, carry the deficit to the next month's rent (non-blocking)
  try {
    await applyFeeCarryover(companyId, input.schedule_entry_id, payout.gross_rent, payout.total_charges)
  } catch (err: any) {
    console.error('[RentGoose] Fee carryover failed (non-blocking):', err.message)
  }

  // Create ClientAccountEntry (payout_out) for rent portion
  const currentBalance = await getCurrentBalance(companyId)
  const newBalance = currentBalance - payout.net_payout

  const { data: clientEntry } = await supabase
    .from('client_account_entries')
    .insert({
      company_id: companyId,
      entry_type: 'payout_out',
      amount: payout.net_payout,
      description: `Rent payout to ${payout.landlord_name}${payout.ownership_percentage < 100 ? ` (${payout.ownership_percentage}%)` : ''} for ${payout.property_address}`,
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

  // If landlord-held deposit, pay it out and mark expected payment as settled
  if (payout.deposit_amount > 0 && payout.deposit_expected_payment_id) {
    const depositBalance = await getCurrentBalance(companyId)
    await supabase.from('client_account_entries').insert({
      company_id: companyId,
      entry_type: 'deposit_out',
      amount: payout.deposit_amount,
      description: `Security deposit (landlord held) paid to ${payout.landlord_name} for ${payout.property_address}`,
      related_id: payoutRecord.id,
      related_type: 'payout_record',
      balance_after: depositBalance - payout.deposit_amount,
      created_by: input.paid_by || null,
      is_manual: false,
    })
    await supabase
      .from('expected_payments')
      .update({ deposit_payout_at: new Date().toISOString() })
      .eq('id', payout.deposit_expected_payment_id)
  }

  // Fire-and-forget: PDF generation, email, document logging, tenant receipt
  // Returns immediately so the agent can move on to the next payout
  const payoutId = payoutRecord.id
  ;(async () => {
    try {
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
        const { generateLandlordStatement } = await import('./rentgooseStatementService')
        const result = await generateLandlordStatement(companyId, payout)
        pdfPath = result.storagePath
        pdfBuffer = result.pdfBuffer
        console.log('[Payout] Statement PDF generated:', pdfPath, 'size:', pdfBuffer?.length, 'bytes')
      } catch (err) {
        console.error('[Payout] Failed to generate statement PDF:', err)
      }

      // Update payout record with PDF path
      if (pdfPath) {
        await supabase.from('payout_records').update({ statement_pdf_path: pdfPath }).eq('id', payoutId)
      }

      // Send statement email
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
            attachments: pdfBuffer ? [{
              filename: `statement-${payout.statement_ref}.pdf`,
              content: pdfBuffer,
            }] : undefined,
          })

          await supabase.from('payout_records').update({ statement_sent_at: new Date().toISOString() }).eq('id', payoutId)
        } catch (err) {
          console.error('[Payout] Failed to send statement email:', err)
        }
      }

      // Save statement to documents
      if (pdfPath && payout.landlord_id) {
        try {
          await supabase.from('property_documents').insert({
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
          console.error('[Payout] Failed to save statement to documents:', err)
        }
      }

      // Send tenant receipt
      if (input.send_tenant_receipt) {
        try {
          await sendTenantReceipt(companyId, input.schedule_entry_id)
        } catch (err) {
          console.error('[Payout] Failed to send tenant receipt:', err)
        }
      }
    } catch (err) {
      console.error('[Payout] Background task failed for payout', payoutId, err)
    }
  })()

  return { payout_id: payoutId }
}

// ============================================================================
// HOLD PAYOUT — Move rent into held monies instead of paying out
// ============================================================================

export async function holdPayout(companyId: string, input: {
  schedule_entry_id: string
  landlord_id?: string
  held_by?: string
}): Promise<{ payout_id: string }> {
  const payouts = await getPayoutsQueue(companyId)
  const payout = payouts.find(p => {
    if (p.schedule_entry_id !== input.schedule_entry_id) return false
    if (input.landlord_id !== undefined && input.landlord_id !== '') {
      return p.landlord_id === input.landlord_id
    }
    return true
  })
  if (!payout) throw new Error('Payout not found in queue')

  // Create payout record with status 'held'
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
      paid_by: input.held_by || null,
      statement_pdf_path: null,
      // Use a metadata flag to indicate held status
    })
    .select()
    .single()

  if (payoutErr) throw payoutErr

  // Mark as held
  await supabase
    .from('payout_records')
    .update({ statement_pdf_path: 'HELD' })
    .eq('id', payoutRecord.id)

  // If charges exceeded rent, carry the deficit to the next month's rent (non-blocking)
  try {
    await applyFeeCarryover(companyId, input.schedule_entry_id, payout.gross_rent, payout.total_charges)
  } catch (err: any) {
    console.error('[RentGoose] Fee carryover failed (non-blocking):', err.message)
  }

  // Create client_account_entry — rent_held_in with the actual amount
  // Balance stays the same because the rent_in already credited on receipt; this just tracks the hold.
  // The agent fee remains in the client account until the agent explicitly processes their payout.
  const currentBalance = await getCurrentBalance(companyId)

  await supabase.from('client_account_entries').insert({
    company_id: companyId,
    entry_type: 'rent_held_in',
    amount: payout.net_payout,
    description: `Rent held for ${payout.landlord_name}${payout.ownership_percentage < 100 ? ` (${payout.ownership_percentage}%)` : ''} — ${payout.property_address}`,
    reference: `HELD-${payoutRecord.id.slice(0, 8).toUpperCase()}`,
    related_id: payoutRecord.id,
    related_type: 'payout_record',
    balance_after: currentBalance,
    created_by: input.held_by || null,
    is_manual: false,
  })

  return { payout_id: payoutRecord.id }
}

export async function getHeldRents(companyId: string): Promise<any[]> {
  const { data: heldPayouts } = await supabase
    .from('payout_records')
    .select('*')
    .eq('company_id', companyId)
    .eq('payout_type', 'landlord')
    .eq('statement_pdf_path', 'HELD')
    .order('created_at', { ascending: false })

  if (!heldPayouts || heldPayouts.length === 0) return []

  // Enrich with property/landlord data
  const landlordIds = [...new Set(heldPayouts.map(p => p.landlord_id).filter(Boolean))]
  const { data: landlords } = landlordIds.length > 0
    ? await supabase.from('landlords').select('id, first_name_encrypted, last_name_encrypted, email_encrypted, bank_account_name_encrypted, bank_account_number_encrypted, bank_sort_code_encrypted').in('id', landlordIds)
    : { data: [] }
  const landlordMap = new Map((landlords || []).map(l => [l.id, l]))

  const entryIds = [...new Set(heldPayouts.map(p => p.schedule_entry_id))]
  const { data: entries } = await supabase
    .from('rent_schedule_entries')
    .select('id, tenancy_id, period_start, period_end')
    .in('id', entryIds)
  const entryMap = new Map((entries || []).map(e => [e.id, e]))

  const tenancyIds = [...new Set((entries || []).map(e => e.tenancy_id))]
  const { data: tenancies } = tenancyIds.length > 0
    ? await supabase.from('tenancies').select('id, property_id').in('id', tenancyIds)
    : { data: [] }
  const tenancyMap = new Map((tenancies || []).map(t => [t.id, t]))

  const propertyIds = [...new Set((tenancies || []).map(t => t.property_id).filter(Boolean))]
  const { data: properties } = propertyIds.length > 0
    ? await supabase.from('properties').select('id, address_line1_encrypted, postcode').in('id', propertyIds)
    : { data: [] }
  const propertyMap = new Map((properties || []).map(p => [p.id, p]))

  return heldPayouts.map(p => {
    const landlord = p.landlord_id ? landlordMap.get(p.landlord_id) : null
    const entry = entryMap.get(p.schedule_entry_id)
    const tenancy = entry ? tenancyMap.get(entry.tenancy_id) : null
    const property = tenancy?.property_id ? propertyMap.get(tenancy.property_id) : null

    return {
      id: p.id,
      schedule_entry_id: p.schedule_entry_id,
      landlord_name: landlord
        ? `${decrypt(landlord.first_name_encrypted) || ''} ${decrypt(landlord.last_name_encrypted) || ''}`.trim()
        : 'Unknown',
      landlord_id: p.landlord_id || '',
      landlord_bank_name: landlord?.bank_account_name_encrypted ? decrypt(landlord.bank_account_name_encrypted) : undefined,
      landlord_bank_sort_code: landlord?.bank_sort_code_encrypted ? decrypt(landlord.bank_sort_code_encrypted) : undefined,
      landlord_bank_account_last4: landlord?.bank_account_number_encrypted
        ? (decrypt(landlord.bank_account_number_encrypted) || '').slice(-4)
        : undefined,
      property_address: property ? decrypt(property.address_line1_encrypted) || '' : '',
      property_postcode: property?.postcode || '',
      period_start: entry?.period_start || '',
      period_end: entry?.period_end || '',
      gross_rent: parseFloat(p.gross_rent),
      total_charges: parseFloat(p.total_charges),
      net_payout: parseFloat(p.net_payout),
      held_at: p.created_at,
    }
  })
}

export async function releaseHeldRent(companyId: string, input: {
  payout_record_id: string
  released_by?: string
}): Promise<{ success: boolean }> {
  // Get the held payout details before deleting
  const { data: payoutRecord } = await supabase
    .from('payout_records')
    .select('id, schedule_entry_id, landlord_id, net_payout')
    .eq('id', input.payout_record_id)
    .eq('company_id', companyId)
    .eq('statement_pdf_path', 'HELD')
    .single()

  if (!payoutRecord) throw new Error('Held payout not found')

  // Delete the held payout record — this puts the entry back into getPayoutsQueue
  // so the agent can process it through the normal payout flow with charges/invoices
  const { error } = await supabase
    .from('payout_records')
    .delete()
    .eq('id', input.payout_record_id)
    .eq('statement_pdf_path', 'HELD')

  if (error) throw error

  // Remove the rent_held_in client account entry
  await supabase
    .from('client_account_entries')
    .delete()
    .eq('related_id', input.payout_record_id)
    .eq('related_type', 'payout_record')
    .eq('entry_type', 'rent_held_in')

  return { success: true }
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

/**
 * Process an agent payout — collects pending agent charges, creates a payout
 * record, marks charges as paid, and debits the client account.
 * If chargeIds is omitted, processes ALL pending agent charges.
 */
export async function processAgentPayout(companyId: string, input: {
  charge_ids?: string[]
  paid_by?: string
}): Promise<{ payout_id: string; total_gross: number; charge_count: number }> {
  // Get pending charges (filtered by IDs if provided)
  let chargeQuery = supabase
    .from('agent_charges')
    .select('id, net_amount, vat_amount, gross_amount')
    .eq('company_id', companyId)
    .eq('included', true)
    .is('agent_paid_at', null)

  if (input.charge_ids && input.charge_ids.length > 0) {
    chargeQuery = chargeQuery.in('id', input.charge_ids)
  }

  const { data: charges, error: chargesErr } = await chargeQuery
  if (chargesErr) throw chargesErr
  if (!charges || charges.length === 0) {
    throw new Error('No pending agent charges to pay out')
  }

  // Sum totals
  const totalNet = charges.reduce((s, c) => s + parseFloat(c.net_amount), 0)
  const totalVat = charges.reduce((s, c) => s + parseFloat(c.vat_amount), 0)
  const totalGross = charges.reduce((s, c) => s + parseFloat(c.gross_amount), 0)

  // Create the agent_payouts record
  const { data: payoutRecord, error: payoutErr } = await supabase
    .from('agent_payouts')
    .insert({
      company_id: companyId,
      total_gross: totalGross,
      total_net: totalNet,
      total_vat: totalVat,
      charge_count: charges.length,
      paid_by: input.paid_by || null,
    })
    .select()
    .single()

  if (payoutErr) throw payoutErr

  // Debit the client account
  const currentBalance = await getCurrentBalance(companyId)
  const newBalance = currentBalance - totalGross

  const { data: clientEntry } = await supabase
    .from('client_account_entries')
    .insert({
      company_id: companyId,
      entry_type: 'payout_out',
      amount: totalGross,
      description: `Agent payout — ${charges.length} charge${charges.length !== 1 ? 's' : ''} (£${totalGross.toFixed(2)})`,
      reference: `AGENT-${payoutRecord.id.slice(0, 8).toUpperCase()}`,
      related_id: payoutRecord.id,
      related_type: 'agent_payout',
      balance_after: newBalance,
      created_by: input.paid_by || null,
      is_manual: false,
    })
    .select()
    .single()

  if (clientEntry) {
    await supabase
      .from('agent_payouts')
      .update({ client_account_entry_id: clientEntry.id })
      .eq('id', payoutRecord.id)
  }

  // Link charges to this payout and mark as paid
  await supabase
    .from('agent_charges')
    .update({
      agent_payout_id: payoutRecord.id,
      agent_paid_at: new Date().toISOString(),
    })
    .in('id', charges.map(c => c.id))

  return {
    payout_id: payoutRecord.id,
    total_gross: totalGross,
    charge_count: charges.length,
  }
}

/**
 * Get history of agent payouts (for the ledger view).
 */
export async function getAgentPayoutHistory(companyId: string): Promise<Array<{
  id: string
  total_gross: number
  total_net: number
  total_vat: number
  charge_count: number
  created_at: string
}>> {
  const { data } = await supabase
    .from('agent_payouts')
    .select('id, total_gross, total_net, total_vat, charge_count, created_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  return (data || []).map(p => ({
    id: p.id,
    total_gross: parseFloat(p.total_gross),
    total_net: parseFloat(p.total_net),
    total_vat: parseFloat(p.total_vat),
    charge_count: p.charge_count,
    created_at: p.created_at,
  }))
}

/**
 * Get details of a single agent payout including all linked charges with property info.
 */
export async function getAgentPayoutDetails(companyId: string, payoutId: string): Promise<{
  payout: any
  charges: Array<{
    id: string
    description: string
    property_address: string
    property_id: string | null
    net_amount: number
    vat_amount: number
    gross_amount: number
  }>
} | null> {
  const { data: payout } = await supabase
    .from('agent_payouts')
    .select('*')
    .eq('id', payoutId)
    .eq('company_id', companyId)
    .single()

  if (!payout) return null

  const { data: charges } = await supabase
    .from('agent_charges')
    .select('id, schedule_entry_id, description, net_amount, vat_amount, gross_amount')
    .eq('agent_payout_id', payoutId)

  // Look up properties via schedule entries → tenancies → properties
  const entryIds = [...new Set((charges || []).map(c => c.schedule_entry_id))]
  const { data: entries } = entryIds.length > 0
    ? await supabase.from('rent_schedule_entries').select('id, tenancy_id').in('id', entryIds)
    : { data: [] }

  const tenancyIds = [...new Set((entries || []).map(e => e.tenancy_id))]
  const { data: tenancies } = tenancyIds.length > 0
    ? await supabase.from('tenancies').select('id, property_id').in('id', tenancyIds)
    : { data: [] }

  const propertyIds = [...new Set((tenancies || []).map(t => t.property_id).filter(Boolean))]
  const { data: properties } = propertyIds.length > 0
    ? await supabase.from('properties').select('id, address_line1_encrypted, postcode').in('id', propertyIds)
    : { data: [] }

  const propMap = new Map(
    (properties || []).map(p => [p.id, {
      id: p.id,
      address: `${decrypt(p.address_line1_encrypted) || ''}, ${p.postcode || ''}`,
    }])
  )
  const tenancyToPropMap = new Map((tenancies || []).map(t => [t.id, t.property_id]))
  const entryToPropMap = new Map(
    (entries || []).map(e => [e.id, tenancyToPropMap.get(e.tenancy_id)])
  )

  return {
    payout: {
      ...payout,
      total_gross: parseFloat(payout.total_gross),
      total_net: parseFloat(payout.total_net),
      total_vat: parseFloat(payout.total_vat),
    },
    charges: (charges || []).map(c => {
      const propId = entryToPropMap.get(c.schedule_entry_id)
      const prop = propId ? propMap.get(propId) : null
      return {
        id: c.id,
        description: c.description,
        property_address: prop?.address || 'Unknown property',
        property_id: prop?.id || null,
        net_amount: parseFloat(c.net_amount),
        vat_amount: parseFloat(c.vat_amount),
        gross_amount: parseFloat(c.gross_amount),
      }
    }),
  }
}

export async function getAgentFees(companyId: string, fromDate?: string, toDate?: string): Promise<{
  fees: Array<{
    id: string
    fee_type: string
    description: string
    property_address: string
    net_amount: number
    vat_amount: number
    gross_amount: number
    status: 'paid' | 'due'
    date: string
    source: 'rent_charge' | 'expected_payment'
  }>
  summary: { total_paid: number; total_due: number; grand_total: number }
}> {
  // 1. Get agent_charges from rent receipts
  let chargeQuery = supabase
    .from('agent_charges')
    .select('*')
    .eq('company_id', companyId)
    .eq('included', true)
    .order('created_at', { ascending: false })

  if (fromDate) chargeQuery = chargeQuery.gte('created_at', `${fromDate}T00:00:00`)
  if (toDate) chargeQuery = chargeQuery.lte('created_at', `${toDate}T23:59:59`)

  const { data: charges } = await chargeQuery

  // Look up schedule entry statuses + property addresses
  const entryIds = [...new Set((charges || []).map(c => c.schedule_entry_id))]
  let entryStatusMap = new Map<string, string>()
  let entryPropertyMap = new Map<string, string>()
  if (entryIds.length > 0) {
    const { data: entries } = await supabase
      .from('rent_schedule_entries')
      .select('id, status, tenancy_id')
      .in('id', entryIds)

    const tenancyIds = [...new Set((entries || []).map(e => e.tenancy_id))]
    const { data: tenancies } = tenancyIds.length > 0
      ? await supabase.from('tenancies').select('id, property_id').in('id', tenancyIds)
      : { data: [] }
    const propertyIds = [...new Set((tenancies || []).map(t => t.property_id).filter(Boolean))]
    const { data: properties } = propertyIds.length > 0
      ? await supabase.from('properties').select('id, address_line1_encrypted, postcode').in('id', propertyIds)
      : { data: [] }

    const propMap = new Map((properties || []).map(p => [p.id, `${decrypt(p.address_line1_encrypted) || ''}, ${p.postcode || ''}`]))
    const tenPropMap = new Map((tenancies || []).map(t => [t.id, t.property_id]))

    for (const e of (entries || [])) {
      entryStatusMap.set(e.id, e.status)
      const propId = tenPropMap.get(e.tenancy_id)
      if (propId) entryPropertyMap.set(e.id, propMap.get(propId) || '')
    }
  }

  const chargeItems = (charges || []).map(c => ({
    id: c.id,
    fee_type: c.charge_type,
    description: c.description,
    property_address: entryPropertyMap.get(c.schedule_entry_id) || '',
    net_amount: parseFloat(c.net_amount),
    vat_amount: parseFloat(c.vat_amount),
    gross_amount: parseFloat(c.gross_amount),
    status: (entryStatusMap.get(c.schedule_entry_id) === 'paid' ? 'paid' : 'due') as 'paid' | 'due',
    date: c.created_at,
    source: 'rent_charge' as const,
  }))

  // 2. Get expected_payments where agent gets a fee
  let epQuery = supabase
    .from('expected_payments')
    .select('*')
    .eq('company_id', companyId)
    .neq('status', 'cancelled')

  if (fromDate) epQuery = epQuery.gte('created_at', `${fromDate}T00:00:00`)
  if (toDate) epQuery = epQuery.lte('created_at', `${toDate}T23:59:59`)

  const { data: expectedPayments } = await epQuery

  const epItems: Array<{
    id: string; fee_type: string; description: string; property_address: string; net_amount: number; vat_amount: number;
    gross_amount: number; status: 'paid' | 'due'; date: string; source: 'rent_charge' | 'expected_payment'
  }> = []
  for (const ep of (expectedPayments || [])) {
    const splits = ep.payout_split || []
    for (const split of splits) {
      if (split.type === 'agent_fee') {
        epItems.push({
          id: ep.id + '-fee',
          fee_type: ep.payment_type,
          description: split.description || ep.description,
          property_address: ep.property_address || '',
          net_amount: parseFloat(split.amount),
          vat_amount: 0,
          gross_amount: parseFloat(split.amount),
          status: (ep.status === 'paid' ? 'paid' : 'due') as 'paid' | 'due',
          date: ep.paid_at || ep.created_at,
          source: 'expected_payment' as const,
        })
      }
    }
    if (ep.payout_type === 'agent' && !splits.some((s: any) => s.type === 'agent_fee')) {
      epItems.push({
        id: ep.id,
        fee_type: ep.payment_type,
        description: ep.description,
        property_address: ep.property_address || '',
        net_amount: parseFloat(ep.amount_due),
        vat_amount: 0,
        gross_amount: parseFloat(ep.amount_due),
        status: (ep.status === 'paid' ? 'paid' : 'due') as 'paid' | 'due',
        date: ep.paid_at || ep.created_at,
        source: 'expected_payment' as const,
      })
    }
  }

  const allFees = [...chargeItems, ...epItems].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const total_paid = allFees.filter(f => f.status === 'paid').reduce((s, f) => s + f.gross_amount, 0)
  const total_due = allFees.filter(f => f.status === 'due').reduce((s, f) => s + f.gross_amount, 0)

  return {
    fees: allFees,
    summary: { total_paid, total_due, grand_total: total_paid + total_due },
  }
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
    .maybeSingle()

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
  entry_type: 'manual_credit' | 'manual_debit' | 'opening_balance'
  amount: number
  description: string
  reference?: string
  created_by?: string
}): Promise<any> {
  const currentBalance = await getCurrentBalance(companyId)
  let newBalance: number
  if (input.entry_type === 'opening_balance') {
    newBalance = input.amount
  } else if (input.entry_type === 'manual_credit') {
    newBalance = currentBalance + input.amount
  } else {
    newBalance = currentBalance - input.amount
  }

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
          // Agent's commission is the cut they take from the contractor invoice,
          // NOT the entire invoice value.
          await supabase.from('agent_charges').insert({
            company_id: companyId,
            schedule_entry_id: entries[0].id,
            charge_type: 'contractor_commission',
            description: `Commission on contractor invoice #${input.invoice_number}`,
            net_amount: commissionNet,
            vat_amount: commissionVatAmount,
            gross_amount: commissionNet + commissionVatAmount,
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

  // Fire-and-forget: generate remittance PDF and email to contractor
  const invoiceId = input.invoice_id
  ;(async () => {
    try {
      // Get contractor details
      const { data: contractor } = await supabase
        .from('contractors')
        .select('name, email, bank_account_name_encrypted')
        .eq('id', invoice.contractor_id)
        .single()

      // Get property address
      let propertyAddress = ''
      if (invoice.property_id) {
        const { data: prop } = await supabase
          .from('properties')
          .select('address_line1_encrypted, postcode')
          .eq('id', invoice.property_id)
          .single()
        if (prop) {
          propertyAddress = `${decrypt(prop.address_line1_encrypted) || ''}, ${prop.postcode || ''}`
        }
      }

      const contractorName = contractor?.name || 'Contractor'
      const contractorEmail = contractor?.email || null

      // Generate remittance PDF
      const { generateContractorRemittance } = await import('./rentgooseRemittanceService')
      const { storagePath, pdfBuffer } = await generateContractorRemittance(companyId, {
        contractor_name: contractorName,
        contractor_email: contractorEmail || undefined,
        invoice_number: invoice.invoice_number,
        invoice_date: invoice.invoice_date,
        property_address: propertyAddress,
        gross_amount: parseFloat(invoice.gross_amount),
        commission_percent: parseFloat(invoice.commission_percent),
        commission_net: parseFloat(invoice.commission_net),
        commission_vat_amount: parseFloat(invoice.commission_vat_amount || 0),
        payout_amount: parseFloat(invoice.payout_to_contractor),
        commission_vat: !!invoice.commission_vat,
      })

      // Save remittance path to invoice
      await supabase
        .from('contractor_invoices')
        .update({ remittance_pdf_path: storagePath })
        .eq('id', invoiceId)

      console.log('[Remittance] PDF generated:', storagePath)

      // Send remittance email to contractor
      if (contractorEmail) {
        try {
          const { data: company } = await supabase
            .from('companies')
            .select('name_encrypted, logo_url')
            .eq('id', companyId)
            .single()
          const companyName = (company?.name_encrypted ? decrypt(company.name_encrypted) : null) || 'PropertyGoose'
          const companyLogo = company?.logo_url || ''

          const commissionTotal = parseFloat(invoice.commission_net) + parseFloat(invoice.commission_vat_amount || 0)
          const invoiceDateFmt = new Date(invoice.invoice_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

          const { sendEmail, loadEmailTemplate } = await import('./emailService')
          const html = loadEmailTemplate('contractor-remittance', {
            ContractorName: contractorName,
            InvoiceNumber: invoice.invoice_number,
            InvoiceDate: invoiceDateFmt,
            PropertyAddress: propertyAddress || 'N/A',
            GrossAmount: parseFloat(invoice.gross_amount).toFixed(2),
            CommissionPercent: parseFloat(invoice.commission_percent).toFixed(0),
            CommissionTotal: commissionTotal.toFixed(2),
            PayoutAmount: parseFloat(invoice.payout_to_contractor).toFixed(2),
            CompanyName: companyName,
            AgentLogoUrl: companyLogo,
          })

          await sendEmail({
            to: contractorEmail,
            subject: `Remittance Advice - Invoice #${invoice.invoice_number}`,
            html,
            companyId,
            emailCategory: 'contractor_remittance',
            attachments: pdfBuffer ? [{
              filename: `remittance-${invoice.invoice_number}.pdf`,
              content: pdfBuffer,
            }] : undefined,
          })

          console.log('[Remittance] Email sent to', contractorEmail)
        } catch (emailErr) {
          console.error('[Remittance] Failed to send email:', emailErr)
        }
      }
    } catch (err) {
      console.error('[Remittance] Background task failed for invoice', invoiceId, err)
    }
  })()

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
  // SAFETY: only operate on companies that have RentGoose enabled.
  const { getRentGooseEnabledCompanyIds } = await import('./rentgooseAccess')
  const enabledIds = await getRentGooseEnabledCompanyIds()
  if (enabledIds.length === 0) return

  const today = new Date().toISOString().split('T')[0]

  // Mark 'upcoming' as 'due' if due_date = today
  await supabase
    .from('rent_schedule_entries')
    .update({ status: 'due', updated_at: new Date().toISOString() })
    .eq('status', 'upcoming')
    .eq('due_date', today)
    .in('company_id', enabledIds)

  // Find 'due' entries that are now past due — capture them before updating
  const { data: newlyOverdue } = await supabase
    .from('rent_schedule_entries')
    .select('id, tenancy_id, company_id, amount_due, due_date')
    .eq('status', 'due')
    .lt('due_date', today)
    .in('company_id', enabledIds)

  if (newlyOverdue && newlyOverdue.length > 0) {
    // Mark as overdue
    await supabase
      .from('rent_schedule_entries')
      .update({ status: 'overdue', updated_at: new Date().toISOString() })
      .in('id', newlyOverdue.map(e => e.id))

    // Create arrears_chases records for any that don't already have one
    const entryIds = newlyOverdue.map(e => e.id)
    const { data: existingChases } = await supabase
      .from('arrears_chases')
      .select('schedule_entry_id')
      .in('schedule_entry_id', entryIds)

    const alreadyChased = new Set((existingChases || []).map(c => c.schedule_entry_id))

    const newChases = newlyOverdue
      .filter(e => !alreadyChased.has(e.id))
      .map(e => ({
        company_id: e.company_id,
        schedule_entry_id: e.id,
        tenant_id: null,
        amount_outstanding: e.amount_due,
        partial_paid: 0,
        status: 'active',
      }))

    if (newChases.length > 0) {
      await supabase.from('arrears_chases').insert(newChases)
    }
  }
}

// ============================================================================
// RENT AMOUNT / DUE DATE PROPAGATION
// ============================================================================

/**
 * Update amount_due on all unpaid future rent schedule entries when tenancy rent changes.
 */
export async function updateFutureRentAmounts(tenancyId: string, newMonthlyRent: number): Promise<void> {
  const today = new Date().toISOString().split('T')[0]

  const { data: entries, error: fetchErr } = await supabase
    .from('rent_schedule_entries')
    .select('id, due_date, status')
    .eq('tenancy_id', tenancyId)
    .in('status', ['upcoming', 'due', 'overdue'])
    .gte('due_date', today)

  if (fetchErr || !entries || entries.length === 0) return

  const { error } = await supabase
    .from('rent_schedule_entries')
    .update({ amount_due: newMonthlyRent, updated_at: new Date().toISOString() })
    .in('id', entries.map(e => e.id))

  if (error) {
    console.error('[RentGoose] Failed to update future rent amounts:', error)
  } else {
    console.log(`[RentGoose] Updated ${entries.length} future entries to £${newMonthlyRent} for tenancy ${tenancyId}`)
  }
}

/**
 * Update due_date on all unpaid future rent schedule entries when rent due day changes.
 */
export async function updateFutureRentDueDates(tenancyId: string, newDueDay: number): Promise<void> {
  const today = new Date().toISOString().split('T')[0]

  const { data: entries, error: fetchErr } = await supabase
    .from('rent_schedule_entries')
    .select('id, due_date, period_start')
    .eq('tenancy_id', tenancyId)
    .in('status', ['upcoming', 'due', 'overdue'])
    .gte('due_date', today)

  if (fetchErr || !entries || entries.length === 0) return

  for (const entry of entries) {
    const period = new Date(entry.period_start)
    const newDueDate = new Date(period.getFullYear(), period.getMonth(), newDueDay)
    // If due day is before period start, push to next month
    if (newDueDate < period) {
      newDueDate.setMonth(newDueDate.getMonth() + 1)
    }

    const todayDate = new Date()
    todayDate.setHours(0, 0, 0, 0)
    const dueDateOnly = new Date(newDueDate)
    dueDateOnly.setHours(0, 0, 0, 0)

    let newStatus = 'upcoming'
    if (dueDateOnly.getTime() === todayDate.getTime()) newStatus = 'due'
    else if (dueDateOnly < todayDate) newStatus = 'overdue'

    await supabase
      .from('rent_schedule_entries')
      .update({
        due_date: newDueDate.toISOString().split('T')[0],
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', entry.id)
  }

  console.log(`[RentGoose] Updated due dates for ${entries.length} future entries to day ${newDueDay} for tenancy ${tenancyId}`)
}

// ============================================================================
// TENANCY LIFECYCLE — ARCHIVE / REACTIVATE
// ============================================================================

/**
 * Cancel all unpaid future rent schedule entries when a tenancy is archived/terminated.
 * Paid entries are preserved for accounting.
 */
export async function cancelScheduleForTenancy(tenancyId: string): Promise<void> {
  const { error } = await supabase
    .from('rent_schedule_entries')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('tenancy_id', tenancyId)
    .not('status', 'in', '("paid","cancelled")')

  if (error) {
    console.error('[RentGoose] Failed to cancel schedule entries:', error)
  } else {
    console.log(`[RentGoose] Cancelled unpaid entries for tenancy ${tenancyId}`)
  }
}

/**
 * Reactivate a tenancy's rent schedule. Un-cancels entries that were cancelled
 * when the tenancy was archived, and regenerates if needed.
 */
export async function reactivateScheduleForTenancy(tenancyId: string, companyId: string): Promise<void> {
  const today = new Date().toISOString().split('T')[0]

  // Un-cancel entries that haven't been paid (restore to correct status)
  const { data: cancelledEntries } = await supabase
    .from('rent_schedule_entries')
    .select('id, due_date')
    .eq('tenancy_id', tenancyId)
    .eq('status', 'cancelled')

  if (cancelledEntries && cancelledEntries.length > 0) {
    for (const entry of cancelledEntries) {
      let newStatus = 'upcoming'
      if (entry.due_date === today) newStatus = 'due'
      else if (entry.due_date < today) newStatus = 'overdue'

      await supabase
        .from('rent_schedule_entries')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', entry.id)
    }
    console.log(`[RentGoose] Reactivated ${cancelledEntries.length} entries for tenancy ${tenancyId}`)
  }

  // If no entries exist at all, generate a fresh schedule
  const { count } = await supabase
    .from('rent_schedule_entries')
    .select('id', { count: 'exact', head: true })
    .eq('tenancy_id', tenancyId)
    .neq('status', 'cancelled')

  if (!count || count === 0) {
    // Reset and regenerate - remove cancelled entries first
    await supabase
      .from('rent_schedule_entries')
      .delete()
      .eq('tenancy_id', tenancyId)
      .eq('status', 'cancelled')

    await initTenancySchedule(tenancyId, companyId)
    console.log(`[RentGoose] Regenerated schedule for tenancy ${tenancyId}`)
  }

  // Extend rolling schedule if periodic
  await extendRollingSchedule(tenancyId, companyId)
}

/**
 * Update the notice end date for a tenancy — re-does pro-rata calculation.
 * Call this when reverting from archived to notice_given with a new end date.
 */
export async function updateNoticeEndDate(tenancyId: string, newEndDate: string, companyId: string): Promise<void> {
  // First, un-cancel any entries that were cancelled when archived
  await reactivateScheduleForTenancy(tenancyId, companyId)

  // Then re-run the notice handling with the new date
  await handleNotice(tenancyId, newEndDate, companyId)

  console.log(`[RentGoose] Updated notice end date to ${newEndDate} for tenancy ${tenancyId}`)
}

// ============================================================================
// EXPECTED PAYMENTS
// ============================================================================

export interface UnifiedPaymentItem {
  id: string
  item_type: 'rent' | 'expected_payment'
  payment_type: string
  tenancy_id?: string
  property_id?: string
  property_address?: string
  property_postcode?: string
  tenant_name?: string
  landlord_name?: string
  landlord_id?: string
  description: string
  amount_due: number
  amount_received: number
  status: string
  due_date?: string
  paid_at?: string
  payout_type?: string
  payout_split?: any[]
  source_type?: string
  source_id?: string
  // Rent-specific
  period_start?: string
  period_end?: string
  fee_percent?: number
  management_type?: string
  tenancy_ref?: string
  tenant_names?: string
  payout_sent_at?: string
  total_charges?: number
  has_rlp?: boolean
}

export async function createExpectedPayment(companyId: string, input: {
  tenancy_id?: string
  property_id?: string
  payment_type: string
  source_type?: string
  source_id?: string
  description: string
  amount_due: number
  amount_received?: number
  status?: string
  due_date?: string
  paid_at?: string
  payment_method?: string
  payment_reference?: string
  receipted_by?: string
  payout_type?: string
  payout_split?: any[]
  property_address?: string
  property_postcode?: string
  tenant_name?: string
  landlord_name?: string
  landlord_id?: string
}): Promise<any> {
  const { data, error } = await supabase
    .from('expected_payments')
    .insert({
      company_id: companyId,
      tenancy_id: input.tenancy_id || null,
      property_id: input.property_id || null,
      payment_type: input.payment_type,
      source_type: input.source_type || null,
      source_id: input.source_id || null,
      description: input.description,
      amount_due: input.amount_due,
      amount_received: input.amount_received || 0,
      status: input.status || 'pending',
      due_date: input.due_date || null,
      paid_at: input.paid_at || null,
      payment_method: input.payment_method || null,
      payment_reference: input.payment_reference || null,
      receipted_by: input.receipted_by || null,
      payout_type: input.payout_type || null,
      payout_split: input.payout_split || null,
      property_address: input.property_address || null,
      property_postcode: input.property_postcode || null,
      tenant_name: input.tenant_name || null,
      landlord_name: input.landlord_name || null,
      landlord_id: input.landlord_id || null,
    })
    .select()
    .single()

  if (error) {
    console.error('[RentGoose] Failed to create expected payment:', error)
    throw error
  }

  return data
}

export async function getExpectedPayments(companyId: string, filters?: {
  payment_type?: string
  status?: string
  date_from?: string
  date_to?: string
  tenancy_id?: string
}): Promise<any[]> {
  let query = supabase
    .from('expected_payments')
    .select('*')
    .eq('company_id', companyId)
    .order('due_date', { ascending: true })

  if (filters?.payment_type) query = query.eq('payment_type', filters.payment_type)
  if (filters?.status && filters.status !== 'all') query = query.eq('status', filters.status)
  else query = query.neq('status', 'cancelled')
  if (filters?.date_from) query = query.gte('due_date', filters.date_from)
  if (filters?.date_to) query = query.lte('due_date', filters.date_to)
  if (filters?.tenancy_id) query = query.eq('tenancy_id', filters.tenancy_id)

  const { data, error } = await query
  if (error) throw error

  return (data || []).map(ep => ({
    ...ep,
    amount_due: parseFloat(ep.amount_due),
    amount_received: parseFloat(ep.amount_received),
  }))
}

export async function receiptExpectedPayment(companyId: string, input: {
  expected_payment_id: string
  amount: number
  payment_method?: string
  payment_reference?: string
  date_received?: string
  receipted_by?: string
  holding_deposit_credit_amount?: number
  holding_deposit_credit_id?: string
}): Promise<{ success: boolean }> {
  const { data: ep, error: epErr } = await supabase
    .from('expected_payments')
    .select('*')
    .eq('id', input.expected_payment_id)
    .eq('company_id', companyId)
    .single()

  if (epErr || !ep) throw new Error('Expected payment not found')

  const now = new Date().toISOString()
  const totalReceived = parseFloat(ep.amount_received) + input.amount
  const amountDue = parseFloat(ep.amount_due)
  const isFullyPaid = totalReceived >= amountDue
  const newStatus = isFullyPaid ? 'paid' : 'partial'

  // Update expected_payment record
  await supabase
    .from('expected_payments')
    .update({
      amount_received: totalReceived,
      status: newStatus,
      paid_at: isFullyPaid ? now : null,
      payment_method: input.payment_method || null,
      payment_reference: input.payment_reference || null,
      receipted_by: input.receipted_by || null,
      updated_at: now,
    })
    .eq('id', input.expected_payment_id)

  // Process payout_split to create client_account_entries
  const splits = ep.payout_split || []
  for (const split of splits) {
    let entryType: string
    let description: string
    const splitAmount = parseFloat(split.amount)

    switch (split.type) {
      case 'landlord_rent':
      case 'landlord_prorata':
        entryType = 'initial_monies_rent_in'
        description = split.description || `Rent portion - ${ep.description}`
        break
      case 'deposit_hold':
        entryType = 'deposit_in'
        description = split.description || `Security deposit - ${ep.description}`
        break
      case 'agent_fee':
        entryType = 'invoice_fee_in'
        description = split.description || `Fee - ${ep.description}`
        break
      case 'holding_deposit':
        entryType = 'holding_deposit_in'
        description = split.description || `Holding deposit - ${ep.description}`
        break
      default:
        entryType = 'initial_monies_rent_in'
        description = split.description || ep.description
    }

    const currentBalance = await getCurrentBalance(companyId)
    const isCredit = ['initial_monies_rent_in', 'deposit_in', 'invoice_fee_in', 'holding_deposit_in'].includes(entryType)
    const newBalance = isCredit ? currentBalance + splitAmount : currentBalance - splitAmount

    await supabase
      .from('client_account_entries')
      .insert({
        company_id: companyId,
        entry_type: entryType,
        amount: splitAmount,
        description,
        reference: input.payment_reference || null,
        related_id: input.expected_payment_id,
        related_type: 'expected_payment',
        balance_after: newBalance,
        created_by: input.receipted_by || null,
        is_manual: false,
      })
  }

  // If holding deposit credit is being applied, create offsetting entry
  if (input.holding_deposit_credit_amount && input.holding_deposit_credit_id) {
    const currentBalance = await getCurrentBalance(companyId)
    const newBalance = currentBalance - input.holding_deposit_credit_amount

    await supabase
      .from('client_account_entries')
      .insert({
        company_id: companyId,
        entry_type: 'holding_deposit_in',
        amount: input.holding_deposit_credit_amount,
        description: `Holding deposit applied to initial monies`,
        related_id: input.holding_deposit_credit_id,
        related_type: 'holding_deposit_offset',
        balance_after: newBalance,
        created_by: input.receipted_by || null,
        is_manual: false,
      })
  }

  return { success: true }
}

export async function getUnifiedSchedule(companyId: string, filters?: {
  status?: string
  payment_type?: string
  category?: string
  date_from?: string
  date_to?: string
}): Promise<{
  items: UnifiedPaymentItem[]
  categoryCounts: Record<string, number>
  summary: { collected: number; due: number; arrears: number; payoutsReady: number; agentFees: number }
}> {
  // Fetch unfiltered — status filtering is applied in memory so summary cards remain accurate
  const rentEntries = await getRentSchedule(companyId, {
    date_from: filters?.date_from,
    date_to: filters?.date_to,
  })

  const expectedPayments = await getExpectedPayments(companyId, {
    date_from: filters?.date_from,
    date_to: filters?.date_to,
  })

  // Fetch active arrears chases with silenced_until — used to mark silenced rent entries
  const entryIds = rentEntries.map(e => e.id)
  const silencedMap = new Map<string, string>()
  if (entryIds.length > 0) {
    const nowIso = new Date().toISOString()
    const { data: chases } = await supabase
      .from('arrears_chases')
      .select('schedule_entry_id, silenced_until')
      .in('schedule_entry_id', entryIds)
      .not('silenced_until', 'is', null)
      .gt('silenced_until', nowIso)
    for (const c of (chases || [])) {
      silencedMap.set(c.schedule_entry_id, c.silenced_until)
    }
  }

  // Map rent entries to unified format
  const rentItems: UnifiedPaymentItem[] = rentEntries.map(e => ({
    id: e.id,
    item_type: 'rent' as const,
    payment_type: 'rent',
    tenancy_id: e.tenancy_id,
    property_id: e.property_id,
    property_address: e.property_address,
    property_postcode: e.property_postcode,
    tenant_name: e.tenant_names,
    tenant_names: e.tenant_names,
    landlord_name: e.landlord_name,
    landlord_id: e.landlord_id,
    description: `Rent ${e.period_start} to ${e.period_end}`,
    amount_due: e.amount_due,
    amount_received: e.amount_received,
    status: e.status,
    due_date: e.due_date,
    paid_at: e.paid_at,
    period_start: e.period_start,
    period_end: e.period_end,
    fee_percent: e.fee_percent,
    management_type: e.management_type,
    tenancy_ref: e.tenancy_ref,
    payout_sent_at: e.payout_sent_at,
    total_charges: e.total_charges,
    has_rlp: e.has_rlp,
    silenced_until: silencedMap.get(e.id) || null,
  }))

  // Map expected payments to unified format
  const expectedItems: UnifiedPaymentItem[] = expectedPayments.map(ep => ({
    id: ep.id,
    item_type: 'expected_payment' as const,
    payment_type: ep.payment_type,
    tenancy_id: ep.tenancy_id,
    property_id: ep.property_id,
    property_address: ep.property_address,
    property_postcode: ep.property_postcode,
    tenant_name: ep.tenant_name,
    landlord_name: ep.landlord_name,
    landlord_id: ep.landlord_id,
    description: ep.description,
    amount_due: ep.amount_due,
    amount_received: ep.amount_received,
    status: ep.status,
    due_date: ep.due_date,
    paid_at: ep.paid_at,
    payout_type: ep.payout_type,
    payout_split: ep.payout_split,
    source_type: ep.source_type,
    source_id: ep.source_id,
  }))

  // Determine which items to include based on category filter
  let allItems: UnifiedPaymentItem[] = []
  const category = filters?.category || 'all'

  if (category === 'all') {
    allItems = [...rentItems, ...expectedItems]
  } else if (category === 'rent') {
    allItems = rentItems
  } else if (category === 'pre_tenancy') {
    allItems = expectedItems.filter(ep =>
      ['holding_deposit', 'initial_monies', 'deposit'].includes(ep.payment_type)
    )
  } else if (category === 'invoices') {
    allItems = expectedItems.filter(ep =>
      ['tenant_change_fee', 'rent_change_fee', 'invoice'].includes(ep.payment_type)
    )
  } else if (category === 'arrears') {
    allItems = [...rentItems, ...expectedItems].filter(item =>
      item.status === 'arrears' || item.status === 'overdue'
    )
  }

  // Apply status filter in memory (never passed to DB so summary stays accurate)
  if (filters?.status && filters.status !== 'all') {
    const s = filters.status
    if (s === 'arrears') {
      allItems = allItems.filter(item => item.status === 'arrears' || item.status === 'overdue')
    } else if (s === 'paid') {
      allItems = allItems.filter(item => item.status === 'paid')
    } else {
      allItems = allItems.filter(item => item.status === s)
    }
  } else if (!filters?.status || filters.status === 'all') {
    // Default: exclude paid and cancelled
    allItems = allItems.filter(item => item.status !== 'paid' && item.status !== 'cancelled')
  }

  // Apply payment_type filter if specified
  if (filters?.payment_type) {
    allItems = allItems.filter(item => item.payment_type === filters.payment_type)
  }

  // Sort by due_date
  allItems.sort((a, b) => {
    const da = a.due_date || '9999-12-31'
    const db = b.due_date || '9999-12-31'
    return da.localeCompare(db)
  })

  // Calculate category counts
  const categoryCounts = {
    all: rentItems.length + expectedItems.length,
    rent: rentItems.length,
    pre_tenancy: expectedItems.filter(ep =>
      ['holding_deposit', 'initial_monies', 'deposit'].includes(ep.payment_type)
    ).length,
    invoices: expectedItems.filter(ep =>
      ['tenant_change_fee', 'rent_change_fee', 'invoice'].includes(ep.payment_type)
    ).length,
    arrears: [...rentItems, ...expectedItems].filter(item =>
      item.status === 'arrears' || item.status === 'overdue'
    ).length,
  }

  // Calculate summary — accurate to the second
  const today = new Date().toISOString().split('T')[0]
  const allForSummary = [...rentItems, ...expectedItems]

  // Due Today: only items due on today's date that haven't been paid
  const dueToday = allForSummary
    .filter(item => item.status !== 'paid' && item.status !== 'cancelled' && item.due_date === today)
    .reduce((sum, item) => sum + (item.amount_due - item.amount_received), 0)

  // Arrears: rent/payments where due date has passed without full receipt
  const arrears = allForSummary
    .filter(item => (item.status === 'arrears' || item.status === 'overdue') ||
      (item.status !== 'paid' && item.status !== 'cancelled' && item.due_date && item.due_date < today))
    .reduce((sum, item) => sum + (item.amount_due - item.amount_received), 0)

  // Agent Fees Due to Pay: unpaid agent charges from payouts (rent management fees + agent-type expected payments)
  const agentFeesDueToPay = rentItems
    .filter(item => item.status === 'paid' && !item.payout_sent_at)
    .reduce((sum, item) => sum + (item.total_charges || 0), 0) +
    expectedItems
      .filter(ep => ep.payout_type === 'agent' && ep.status === 'paid')
      .reduce((sum, ep) => sum + ep.amount_received, 0)

  const payoutsReady = rentItems
    .filter(item => item.status === 'paid' && !item.payout_sent_at)
    .reduce((sum, item) => sum + (item.amount_received - (item.total_charges || 0)), 0)

  return {
    items: allItems,
    categoryCounts,
    summary: { collected: agentFeesDueToPay, due: dueToday, arrears, payoutsReady, agentFees: agentFeesDueToPay },
  }
}

export async function getHoldingDepositCredit(companyId: string, tenancyId: string): Promise<{
  available: boolean
  amount: number
  expected_payment_id: string | null
}> {
  const { data } = await supabase
    .from('expected_payments')
    .select('id, amount_received')
    .eq('company_id', companyId)
    .eq('tenancy_id', tenancyId)
    .eq('payment_type', 'holding_deposit')
    .eq('status', 'paid')
    .limit(1)
    .maybeSingle()

  if (data && parseFloat(data.amount_received) > 0) {
    return {
      available: true,
      amount: parseFloat(data.amount_received),
      expected_payment_id: data.id,
    }
  }

  return { available: false, amount: 0, expected_payment_id: null }
}

export async function markDepositProtected(companyId: string, input: {
  expected_payment_id: string
  dan_reference: string
  scheme: string
  protected_date: string
  receipted_by?: string
}): Promise<any> {
  // Get the deposit expected payment
  const { data: ep } = await supabase
    .from('expected_payments')
    .select('*')
    .eq('id', input.expected_payment_id)
    .eq('company_id', companyId)
    .single()

  if (!ep) throw new Error('Expected payment not found')

  // Create deposit_out client_account_entry
  const depositAmount = parseFloat(ep.amount_received) || parseFloat(ep.amount_due)
  const currentBalance = await getCurrentBalance(companyId)
  const newBalance = currentBalance - depositAmount

  const { data: entry, error } = await supabase
    .from('client_account_entries')
    .insert({
      company_id: companyId,
      entry_type: 'deposit_out',
      amount: depositAmount,
      description: `Deposit registered with ${input.scheme} - DAN: ${input.dan_reference}`,
      reference: input.dan_reference,
      related_id: input.expected_payment_id,
      related_type: 'deposit_protection',
      balance_after: newBalance,
      created_by: input.receipted_by || null,
      is_manual: false,
    })
    .select()
    .single()

  if (error) throw error

  return entry
}
