import { supabase } from '../config/supabase'
import { decrypt } from './encryption'
import { sendEmail, loadEmailTemplate } from './emailService'
import { getRentGooseEnabledCompanyIds } from './rentgooseAccess'

const CHASE_INTERVAL = 60 * 60 * 1000 // Check every hour

export function startArrearsChaseScheduler(): void {
  console.log('[ArrearsChase] Scheduler started')
  setInterval(processArrearsChases, CHASE_INTERVAL)
  // Run once on startup after a short delay
  setTimeout(processArrearsChases, 10000)
}

async function processArrearsChases(): Promise<void> {
  try {
    // SAFETY: only process arrears for companies that have RentGoose enabled.
    // Without this gate, ANY tenant in the system could receive arrears emails
    // from a company that never opted into RentGoose.
    const enabledCompanyIds = await getRentGooseEnabledCompanyIds()
    if (enabledCompanyIds.length === 0) return

    const { data: activeChases } = await supabase
      .from('arrears_chases')
      .select('*, rent_schedule_entries!inner(tenancy_id, due_date)')
      .eq('status', 'active')
      .in('company_id', enabledCompanyIds)

    if (!activeChases || activeChases.length === 0) return

    const today = new Date()

    for (const chase of activeChases) {
      // Skip silenced chases
      if (chase.silenced_until && new Date(chase.silenced_until) > today) continue

      const dueDate = new Date(chase.rent_schedule_entries.due_date)
      const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))

      if (daysOverdue >= 90 && !chase.day90_sent_at) {
        // Only send day 90 if full amount is still outstanding (no partial payment received)
        if (parseFloat(chase.partial_paid || 0) === 0) {
          await sendChaseEmail(chase, 90)
        }
      } else if (daysOverdue >= 28 && !chase.day28_sent_at) {
        await sendChaseEmail(chase, 28)
      } else if (daysOverdue >= 21 && !chase.day21_sent_at) {
        await sendChaseEmail(chase, 21)
      } else if (daysOverdue >= 14 && !chase.day14_sent_at) {
        await sendChaseEmail(chase, 14)
      } else if (daysOverdue >= 7 && !chase.day7_sent_at) {
        await sendChaseEmail(chase, 7)
      }
    }
  } catch (err) {
    console.error('[ArrearsChase] Error processing chases:', err)
  }
}

async function sendChaseEmail(chase: any, dayTrigger: number): Promise<void> {
  try {
    const tenancyId = chase.rent_schedule_entries.tenancy_id

    // Get tenant details
    let tenantEmail: string | null = null
    let tenantName = 'Tenant'
    let guarantorEmail: string | null = null
    let guarantorName: string | null = null

    if (chase.tenant_id) {
      const { data: tenant } = await supabase
        .from('tenancy_tenants')
        .select('first_name_encrypted, last_name_encrypted, email_encrypted, guarantor_reference_id')
        .eq('id', chase.tenant_id)
        .single()

      if (tenant) {
        tenantEmail = decrypt(tenant.email_encrypted)
        tenantName = `${decrypt(tenant.first_name_encrypted) || ''} ${decrypt(tenant.last_name_encrypted) || ''}`.trim()

        // Get guarantor if exists
        if (tenant.guarantor_reference_id) {
          const { data: guarantorRef } = await supabase
            .from('tenant_references')
            .select('tenant_first_name_encrypted, tenant_last_name_encrypted, tenant_email_encrypted')
            .eq('id', tenant.guarantor_reference_id)
            .single()

          if (guarantorRef) {
            guarantorEmail = decrypt(guarantorRef.tenant_email_encrypted)
            guarantorName = `${decrypt(guarantorRef.tenant_first_name_encrypted) || ''} ${decrypt(guarantorRef.tenant_last_name_encrypted) || ''}`.trim()
          }
        }
      }
    }

    if (!tenantEmail) return

    // Get tenancy/property details
    const { data: tenancy } = await supabase
      .from('tenancies')
      .select('property_id, company_id')
      .eq('id', tenancyId)
      .single()

    if (!tenancy) return

    const { data: property } = await supabase
      .from('properties')
      .select('address_line1_encrypted, postcode')
      .eq('id', tenancy.property_id)
      .single()

    const propertyAddress = property
      ? `${decrypt(property.address_line1_encrypted) || ''}, ${property.postcode || ''}`
      : 'your property'

    // Get company client account details
    const { data: company } = await supabase
      .from('companies')
      .select('name_encrypted, bank_account_name, bank_account_number, bank_sort_code, logo_url, phone_encrypted, email_encrypted')
      .eq('id', tenancy.company_id)
      .single()

    const companyName = (company?.name_encrypted ? decrypt(company.name_encrypted) : null) || 'PropertyGoose'
    const companyLogo = company?.logo_url || ''
    const clientAccountDetails = company
      ? `Account Name: ${company.bank_account_name || 'N/A'}\nSort Code: ${company.bank_sort_code || 'N/A'}\nAccount Number: ${company.bank_account_number || 'N/A'}`
      : ''

    // Check for custom template
    const { data: customTemplate } = await supabase
      .from('arrears_email_templates')
      .select('subject, body_html')
      .eq('company_id', tenancy.company_id)
      .eq('day_trigger', dayTrigger)
      .single()

    const templateName = `arrears-day${dayTrigger}`
    const templateVars = {
      TenantName: tenantName,
      PropertyAddress: propertyAddress,
      AmountOutstanding: parseFloat(chase.amount_outstanding).toFixed(2),
      DueDate: new Date(chase.rent_schedule_entries.due_date).toLocaleDateString('en-GB'),
      PartialPaid: parseFloat(chase.partial_paid).toFixed(2),
      ClientAccountDetails: clientAccountDetails,
      GuarantorName: guarantorName || '',
      CompanyName: companyName,
      AgentLogoUrl: companyLogo,
    }

    let html: string
    let subject: string

    if (customTemplate) {
      // Use custom template with variable replacement
      html = customTemplate.body_html
      subject = customTemplate.subject
      Object.entries(templateVars).forEach(([key, value]) => {
        const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g')
        html = html.replace(regex, value)
        subject = subject.replace(regex, value)
      })
    } else {
      // Use default template
      try {
        html = loadEmailTemplate(templateName, templateVars)
        subject = getDefaultSubject(dayTrigger, propertyAddress)
      } catch {
        console.error(`[ArrearsChase] Template ${templateName} not found, skipping`)
        return
      }
    }

    // Send to tenant
    const emailCategory = `arrears_day${dayTrigger}`
    await sendEmail({ to: tenantEmail, subject, html, companyId: tenancy.company_id, emailCategory })

    // Send to guarantor if exists
    if (guarantorEmail) {
      await sendEmail({ to: guarantorEmail, subject, html, companyId: tenancy.company_id, emailCategory })
    }

    // Update chase record
    const updateField = `day${dayTrigger}_sent_at`
    await supabase
      .from('arrears_chases')
      .update({ [updateField]: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', chase.id)

    console.log(`[ArrearsChase] Day ${dayTrigger} chase sent for chase ${chase.id}`)
  } catch (err) {
    console.error(`[ArrearsChase] Failed to send day ${dayTrigger} chase for ${chase.id}:`, err)
  }
}

function getDefaultSubject(dayTrigger: number, propertyAddress: string): string {
  switch (dayTrigger) {
    case 7:  return `Rent Payment Reminder — ${propertyAddress}`
    case 14: return `Rent Payment Outstanding — ${propertyAddress}`
    case 21: return `Rent Arrears Notice — ${propertyAddress}`
    case 28: return `Rent Arrears — 28 Days Outstanding — ${propertyAddress}`
    case 90: return `Notice of Escalation — ${propertyAddress}`
    default: return `Rent Arrears Notice — ${propertyAddress}`
  }
}
