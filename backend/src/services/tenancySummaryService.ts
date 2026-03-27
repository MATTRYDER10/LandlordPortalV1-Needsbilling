import { supabase } from '../config/supabase'
import { decrypt } from './encryption'

/**
 * Generate a comprehensive tenancy summary document
 * Includes: property, tenants, landlords, pre-tenancy actions, agreement, deposit,
 * compliance, reference results, notes, and full audit trail
 */
export async function generateTenancySummary(tenancyId: string, _companyId?: string): Promise<{ success: boolean; html?: string; title?: string; error?: string }> {
  try {
    // Load full tenancy data (no company_id filter — tenancy ID is unique and auth is checked in the route)
    const { data: tenancy, error: tenancyError } = await supabase
      .from('tenancies')
      .select(`
        *,
        properties (
          id, postcode, address_line1_encrypted, city_encrypted, county_encrypted,
          full_address_encrypted, property_type, number_of_bedrooms, apex27_listing_id,
          property_landlords (
            id, ownership_percentage, is_primary_contact,
            landlords (id, first_name_encrypted, last_name_encrypted, email_encrypted, phone_encrypted)
          ),
          compliance_records (id, compliance_type, issue_date, expiry_date, status, certificate_number, issuer_name)
        ),
        agreements (id, status, sent_at, signed_at, created_at)
      `)
      .eq('id', tenancyId)
      .single()

    if (tenancyError || !tenancy) {
      return { success: false, error: 'Tenancy not found' }
    }

    // Load tenants
    const { data: tenants } = await supabase
      .from('tenancy_tenants')
      .select('*')
      .eq('tenancy_id', tenancyId)
      .order('is_lead_tenant', { ascending: false })

    // Load notes
    const { data: notes } = await supabase
      .from('tenancy_notes')
      .select('content, created_at, created_by_name')
      .eq('tenancy_id', tenancyId)
      .order('created_at', { ascending: false })

    // Load activity log
    const { data: activities } = await supabase
      .from('tenancy_activity')
      .select('action, title, description, created_at, performed_by_name, is_system_action')
      .eq('tenancy_id', tenancyId)
      .order('created_at', { ascending: true })

    // Load reference results if available
    const { data: references } = await supabase
      .from('tenant_references')
      .select('id, status, tenant_first_name_encrypted, tenant_last_name_encrypted, created_at, completed_at')
      .eq('tenancy_id', tenancyId)

    // Load TDS registration
    const { data: tdsReg } = await supabase
      .from('tds_registrations')
      .select('dan, status, deposit_amount, created_at, scheme_type')
      .eq('tenancy_id', tenancyId)
      .order('created_at', { ascending: false })
      .limit(1)

    // Build the summary document
    const property = tenancy.properties
    const agreement = tenancy.agreements
    const propertyAddress = property?.full_address_encrypted ? decrypt(property.full_address_encrypted) : 'Unknown'
    const now = new Date().toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short' })

    let html = `
<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Tenancy Summary</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; color: #1f2937; font-size: 13px; line-height: 1.5; }
  h1 { font-size: 20px; border-bottom: 2px solid #f97316; padding-bottom: 8px; margin-bottom: 4px; }
  h2 { font-size: 15px; color: #f97316; margin-top: 24px; margin-bottom: 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
  .meta { color: #6b7280; font-size: 11px; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  td { padding: 4px 8px; vertical-align: top; }
  td:first-child { font-weight: 600; color: #374151; width: 180px; }
  .status { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
  .status-active { background: #dcfce7; color: #166534; }
  .status-pending { background: #fef3c7; color: #92400e; }
  .status-completed { background: #dbeafe; color: #1e40af; }
  .note { background: #f9fafb; padding: 8px 12px; border-left: 3px solid #e5e7eb; margin-bottom: 8px; }
  .note-meta { font-size: 11px; color: #9ca3af; }
  .timeline { border-left: 2px solid #e5e7eb; padding-left: 16px; margin-left: 8px; }
  .timeline-item { position: relative; margin-bottom: 8px; }
  .timeline-item::before { content: ''; position: absolute; left: -21px; top: 6px; width: 8px; height: 8px; border-radius: 50%; background: #f97316; }
  .timeline-date { font-size: 11px; color: #9ca3af; }
  .section { page-break-inside: avoid; }
  @media print { body { font-size: 11px; } }
</style>
</head><body>
<h1>Tenancy Summary</h1>
<div class="meta">Generated: ${now} | Tenancy ID: ${tenancyId.substring(0, 8)}</div>
`

    // Property Details
    html += `<div class="section"><h2>Property</h2><table>`
    html += row('Address', propertyAddress)
    html += row('Postcode', property?.postcode || '-')
    html += row('Type', property?.property_type ? capitalise(property.property_type) : '-')
    html += row('Bedrooms', property?.number_of_bedrooms || '-')
    html += `</table></div>`

    // Landlords
    const landlords = property?.property_landlords || []
    if (landlords.length > 0) {
      html += `<div class="section"><h2>Landlords</h2><table>`
      for (const pl of landlords) {
        const ll = pl.landlords
        if (!ll) continue
        const name = `${decrypt(ll.first_name_encrypted) || ''} ${decrypt(ll.last_name_encrypted) || ''}`.trim()
        const email = decrypt(ll.email_encrypted) || ''
        const phone = decrypt(ll.phone_encrypted) || ''
        html += row(pl.is_primary_contact ? 'Primary Landlord' : 'Joint Landlord', `${name}${email ? ` — ${email}` : ''}${phone ? ` — ${phone}` : ''} (${pl.ownership_percentage || 100}%)`)
      }
      html += `</table></div>`
    }

    // Tenancy Details
    html += `<div class="section"><h2>Tenancy Details</h2><table>`
    html += row('Status', `<span class="status status-${tenancy.status === 'active' ? 'active' : 'pending'}">${capitalise(tenancy.status)}</span>`)
    html += row('Type', capitalise(tenancy.tenancy_type || 'AST'))
    html += row('Start Date', formatDate(tenancy.start_date))
    html += row('End Date', formatDate(tenancy.end_date || tenancy.fixed_term_end_date) || 'Periodic')
    html += row('Monthly Rent', tenancy.monthly_rent ? `£${Number(tenancy.monthly_rent).toFixed(2)}` : '-')
    html += row('Rent Due Day', tenancy.rent_due_day ? `${ordinal(tenancy.rent_due_day)} of each month` : '-')
    html += row('Deposit Amount', tenancy.deposit_amount ? `£${Number(tenancy.deposit_amount).toFixed(2)}` : '-')
    html += row('Deposit Scheme', tenancy.deposit_scheme ? capitalise(tenancy.deposit_scheme) : '-')
    if (tenancy.has_break_clause) {
      html += row('Break Clause', `${formatDate(tenancy.break_clause_date)} (${tenancy.break_clause_notice_days} days notice)`)
    }
    html += row('Bills Included', tenancy.bills_included ? 'Yes' : 'No')
    if (tenancy.management_type) {
      html += row('Management', capitalise(tenancy.management_type))
    }
    html += `</table></div>`

    // Tenants
    if (tenants && tenants.length > 0) {
      html += `<div class="section"><h2>Tenants</h2><table>`
      for (const t of tenants) {
        const name = `${decrypt(t.first_name_encrypted) || ''} ${decrypt(t.last_name_encrypted) || ''}`.trim()
        const email = decrypt(t.email_encrypted) || ''
        const label = t.is_lead_tenant ? 'Lead Tenant' : 'Joint Tenant'
        const statusLabel = t.status !== 'active' ? ` [${capitalise(t.status)}]` : ''
        html += row(label, `${name}${statusLabel}${email ? ` — ${email}` : ''}${t.rent_share ? ` — £${Number(t.rent_share).toFixed(2)}/m` : ''}`)
      }
      html += `</table></div>`
    }

    // Pre-Tenancy Actions
    html += `<div class="section"><h2>Pre-Tenancy Actions</h2><table>`

    // Move-in time
    if (tenancy.move_in_time_confirmed) {
      html += row('Move-In Time', `${tenancy.move_in_time_confirmed} on ${formatDate(tenancy.start_date)}`)
      html += row('Confirmed At', formatDateTime(tenancy.move_in_time_confirmed_at))
    } else if (tenancy.move_in_time_requested_at) {
      html += row('Move-In Time', 'Requested — awaiting tenant response')
      html += row('Requested At', formatDateTime(tenancy.move_in_time_requested_at))
    } else {
      html += row('Move-In Time', 'Not yet requested')
    }

    // Compliance pack
    if (tenancy.compliance_pack_sent_at) {
      html += row('Compliance Pack', `Served on ${formatDateTime(tenancy.compliance_pack_sent_at)}`)
      // List what's included
      const complianceDocs = property?.compliance_records || []
      const validDocs = complianceDocs.filter((c: any) => c.status !== 'expired')
      const docTypes = validDocs.map((c: any) => capitalise(c.compliance_type.replace(/_/g, ' '))).join(', ')
      html += row('Pack Contents', [
        'How to Rent Guide',
        'Prescribed Information',
        docTypes ? `Compliance Docs: ${docTypes}` : null,
        'Renters\' Rights Bill Information'
      ].filter(Boolean).join(', '))
    } else {
      html += row('Compliance Pack', 'Not yet served')
    }

    // Initial monies
    if (tenancy.initial_monies_paid_at) {
      html += row('Initial Monies', `Paid and confirmed on ${formatDateTime(tenancy.initial_monies_paid_at)}`)
    } else if (tenancy.initial_monies_requested_at) {
      html += row('Initial Monies', `Requested on ${formatDateTime(tenancy.initial_monies_requested_at)} — awaiting payment`)
    } else {
      html += row('Initial Monies', 'Not yet requested')
    }

    // Deposit protection
    if (tenancy.deposit_protected_at) {
      html += row('Deposit Protection', `Protected on ${formatDateTime(tenancy.deposit_protected_at)}`)
      if (tdsReg && tdsReg.length > 0) {
        html += row('DAN / Reference', tdsReg[0].dan || tdsReg[0].status || '-')
      }
    } else if (tenancy.deposit_amount) {
      html += row('Deposit Protection', 'Not yet protected')
    }

    html += `</table></div>`

    // Agreement
    if (agreement) {
      html += `<div class="section"><h2>Tenancy Agreement</h2><table>`
      html += row('Status', `<span class="status status-${agreement.status === 'fully_signed' || agreement.status === 'executed' ? 'completed' : 'pending'}">${capitalise(agreement.status?.replace(/_/g, ' ') || 'Unknown')}</span>`)
      html += row('Created', formatDateTime(agreement.created_at))
      if (agreement.sent_at) html += row('Sent to Tenants', formatDateTime(agreement.sent_at))
      if (agreement.signed_at) html += row('Fully Signed', formatDateTime(agreement.signed_at))
      html += `</table></div>`
    }

    // Compliance Records
    const complianceRecords = property?.compliance_records || []
    if (complianceRecords.length > 0) {
      html += `<div class="section"><h2>Compliance Records</h2><table>`
      html += `<tr><td style="font-weight:600">Type</td><td style="font-weight:600">Status</td><td style="font-weight:600">Expiry</td><td style="font-weight:600">Certificate</td></tr>`
      for (const c of complianceRecords) {
        const statusClass = c.status === 'valid' ? 'active' : c.status === 'expired' ? 'pending' : 'pending'
        html += `<tr><td>${capitalise(c.compliance_type.replace(/_/g, ' '))}</td><td><span class="status status-${statusClass}">${capitalise(c.status)}</span></td><td>${formatDate(c.expiry_date)}</td><td>${c.certificate_number || '-'}</td></tr>`
      }
      html += `</table></div>`
    }

    // Reference Results
    if (references && references.length > 0) {
      html += `<div class="section"><h2>Reference Results</h2><table>`
      for (const ref of references) {
        const refName = `${decrypt(ref.tenant_first_name_encrypted) || ''} ${decrypt(ref.tenant_last_name_encrypted) || ''}`.trim()
        const statusClass = ref.status === 'completed' || ref.status === 'accepted' ? 'completed' : 'pending'
        html += row(refName || 'Tenant', `<span class="status status-${statusClass}">${capitalise(ref.status)}</span> — Started: ${formatDate(ref.created_at)}${ref.completed_at ? ` — Completed: ${formatDate(ref.completed_at)}` : ''}`)
      }
      html += `</table></div>`
    }

    // Notes
    if (notes && notes.length > 0) {
      html += `<div class="section"><h2>Notes</h2>`
      for (const note of notes) {
        html += `<div class="note"><div>${note.content}</div><div class="note-meta">${note.created_by_name || 'System'} — ${formatDateTime(note.created_at)}</div></div>`
      }
      html += `</div>`
    }

    // Activity Timeline
    if (activities && activities.length > 0) {
      html += `<div class="section"><h2>Activity Timeline</h2><div class="timeline">`
      for (const a of activities) {
        html += `<div class="timeline-item"><div><strong>${a.title || a.action}</strong></div>`
        if (a.description) html += `<div>${a.description}</div>`
        html += `<div class="timeline-date">${formatDateTime(a.created_at)} — ${a.performed_by_name || (a.is_system_action ? 'System' : 'Unknown')}</div></div>`
      }
      html += `</div></div>`
    }

    html += `
<div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; text-align: center; color: #9ca3af; font-size: 11px;">
  PropertyGoose — Tenancy Summary Document — Generated ${now}
</div>
</body></html>`

    return {
      success: true,
      html,
      title: `Tenancy Summary - ${propertyAddress}`
    }
  } catch (err) {
    console.error('[TenancySummary] Error generating summary:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Failed to generate summary' }
  }
}

// Helpers
function row(label: string, value: any): string {
  return `<tr><td>${label}</td><td>${value ?? '-'}</td></tr>`
}

function capitalise(str: string): string {
  if (!str) return ''
  return str.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function formatDate(date: string | null | undefined): string {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDateTime(date: string | null | undefined): string {
  if (!date) return '-'
  return new Date(date).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}
