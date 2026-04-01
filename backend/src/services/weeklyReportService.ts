import { supabase } from '../config/supabase'
import { decrypt } from './encryption'
import { sendEmail, loadEmailTemplate } from './emailService'

const WEEKLY_REPORT_CHECK_INTERVAL_MS = 60 * 60 * 1000 // 1 hour
let lastReportSentDate: string | null = null

/**
 * Send weekly performance reports to all companies that have negotiators.
 * Called every hour; only fires on Monday 8am UK time.
 */
export async function sendWeeklyPerformanceReports(): Promise<{ success: boolean; companiesSent?: number; error?: string }> {
  try {
    // Check if it's Monday 8am UK time
    const now = new Date()
    const ukTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/London' }))
    const dayOfWeek = ukTime.getDay() // 0=Sun, 1=Mon
    const hour = ukTime.getHours()

    if (dayOfWeek !== 1 || hour !== 8) {
      return { success: true, companiesSent: 0 }
    }

    // Prevent duplicate sends on the same day
    const todayStr = ukTime.toISOString().split('T')[0]
    if (lastReportSentDate === todayStr) {
      return { success: true, companiesSent: 0 }
    }

    console.log('[WeeklyReport] Sending weekly performance reports...')

    // Find companies that have active negotiators
    const { data: companyIds } = await supabase
      .from('negotiators')
      .select('company_id')
      .eq('is_active', true)

    if (!companyIds || companyIds.length === 0) {
      console.log('[WeeklyReport] No companies with negotiators found')
      lastReportSentDate = todayStr
      return { success: true, companiesSent: 0 }
    }

    const uniqueCompanyIds = [...new Set(companyIds.map(c => c.company_id))]

    // Date range: last 7 days
    const weekAgo = new Date(now)
    weekAgo.setDate(weekAgo.getDate() - 7)
    const rangeStart = weekAgo.toISOString()

    const weekRangeStart = weekAgo.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
    const weekRangeEnd = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    const weekRange = `${weekRangeStart} — ${weekRangeEnd}`

    let companiesSent = 0

    for (const companyId of uniqueCompanyIds) {
      try {
        await sendReportForCompany(companyId, rangeStart, weekRange)
        companiesSent++
      } catch (err: any) {
        console.error(`[WeeklyReport] Failed for company ${companyId}:`, err.message)
      }
    }

    lastReportSentDate = todayStr
    console.log(`[WeeklyReport] Sent reports to ${companiesSent} companies`)
    return { success: true, companiesSent }
  } catch (error: any) {
    console.error('[WeeklyReport] Error:', error)
    return { success: false, error: error.message }
  }
}

async function sendReportForCompany(companyId: string, rangeStart: string, weekRange: string) {
  // Get company details
  const { data: company } = await supabase
    .from('companies')
    .select('name_encrypted, email_encrypted, logo_url, offer_notification_email')
    .eq('id', companyId)
    .single()

  if (!company) return

  const companyName = company.name_encrypted ? (decrypt(company.name_encrypted) || 'PropertyGoose') : 'PropertyGoose'
  const companyEmail = company.email_encrypted ? decrypt(company.email_encrypted) : null
  const recipientEmail = company.offer_notification_email || companyEmail
  if (!recipientEmail) return

  const logoUrl = company.logo_url || 'https://www.propertygoose.co.uk/logo.png'

  // Get negotiators
  const { data: negotiators } = await supabase
    .from('negotiators')
    .select('id, name')
    .eq('company_id', companyId)
    .eq('is_active', true)

  if (!negotiators || negotiators.length === 0) return

  // Offers sent
  const { data: sentRows } = await supabase
    .from('sent_offer_forms')
    .select('negotiator_id')
    .eq('company_id', companyId)
    .gte('created_at', rangeStart)
    .not('negotiator_id', 'is', null)

  // Offers received
  const { data: receivedRows } = await supabase
    .from('tenant_offers')
    .select('negotiator_id')
    .eq('company_id', companyId)
    .gte('created_at', rangeStart)
    .not('negotiator_id', 'is', null)

  // Let agreed
  const { data: letAgreedRows } = await supabase
    .from('tenant_offers')
    .select('negotiator_id, property_address_encrypted')
    .eq('company_id', companyId)
    .gte('holding_deposit_received_at', rangeStart)
    .not('negotiator_id', 'is', null)

  // Get let agreed offers with tenant names for property list
  const { data: letAgreedDetails } = await supabase
    .from('tenant_offers')
    .select(`
      negotiator_id,
      property_address_encrypted,
      tenant_offer_tenants (name_encrypted, tenant_order)
    `)
    .eq('company_id', companyId)
    .gte('holding_deposit_received_at', rangeStart)
    .not('negotiator_id', 'is', null)

  const countBy = (rows: any[] | null) => {
    const map: Record<string, number> = {}
    if (!rows) return map
    for (const row of rows) {
      const key = row.negotiator_id
      if (key) map[key] = (map[key] || 0) + 1
    }
    return map
  }

  const sentMap = countBy(sentRows)
  const receivedMap = countBy(receivedRows)
  const letAgreedMap = countBy(letAgreedRows)

  const stats = negotiators.map(n => ({
    name: n.name,
    sent: sentMap[n.id] || 0,
    received: receivedMap[n.id] || 0,
    letAgreed: letAgreedMap[n.id] || 0
  }))
  stats.sort((a, b) => b.letAgreed - a.letAgreed || b.received - a.received)

  const totalSent = stats.reduce((s, n) => s + n.sent, 0)
  const totalReceived = stats.reduce((s, n) => s + n.received, 0)
  const totalLetAgreed = stats.reduce((s, n) => s + n.letAgreed, 0)
  const topPerformer = stats[0]?.name || 'N/A'

  // Build performance table rows HTML
  const performanceTableRows = stats.map(s => `
    <tr>
      <td style="padding: 12px 16px; font-size: 14px; color: #111827; border-bottom: 1px solid #e5e7eb;">${s.name}</td>
      <td style="padding: 12px 16px; font-size: 14px; color: #4b5563; text-align: center; border-bottom: 1px solid #e5e7eb;">${s.sent}</td>
      <td style="padding: 12px 16px; font-size: 14px; color: #4b5563; text-align: center; border-bottom: 1px solid #e5e7eb;">${s.received}</td>
      <td style="padding: 12px 16px; font-size: 14px; color: #065f46; font-weight: 600; text-align: center; border-bottom: 1px solid #e5e7eb;">${s.letAgreed}</td>
    </tr>
  `).join('')

  // Build property list for let agreed deals
  let propertyListHtml = ''
  if (letAgreedDetails && letAgreedDetails.length > 0) {
    const propertyItems = letAgreedDetails.map(deal => {
      const address = deal.property_address_encrypted ? decrypt(deal.property_address_encrypted) : 'Unknown'
      const tenants = (deal.tenant_offer_tenants || [])
        .sort((a: any, b: any) => a.tenant_order - b.tenant_order)
      const leadTenantName = tenants.length > 0 && tenants[0].name_encrypted
        ? decrypt(tenants[0].name_encrypted)
        : 'Unknown'
      const negotiator = negotiators.find(n => n.id === deal.negotiator_id)
      return `<li style="margin-bottom: 8px; font-size: 14px; color: #4b5563;">${address} — ${leadTenantName} (${negotiator?.name || 'Unassigned'})</li>`
    }).join('')

    propertyListHtml = `
      <div style="margin-top: 32px;">
        <h3 style="margin: 0 0 12px; font-size: 16px; font-weight: 600; color: #111827;">Let Agreed This Week</h3>
        <ul style="margin: 0; padding-left: 20px;">
          ${propertyItems}
        </ul>
      </div>
    `
  }

  const html = loadEmailTemplate('weekly-performance-report', {
    CompanyName: companyName,
    AgentLogoUrl: logoUrl,
    WeekRange: weekRange,
    PerformanceTableRows: performanceTableRows,
    TopPerformerName: topPerformer,
    TotalOffersSent: String(totalSent),
    TotalOffersReceived: String(totalReceived),
    TotalLetAgreed: String(totalLetAgreed),
    PropertyListHtml: propertyListHtml
  })

  await sendEmail({
    to: recipientEmail,
    subject: `Weekly Performance Report — ${weekRange}`,
    html
  })

  console.log(`[WeeklyReport] Sent report for ${companyName} to ${recipientEmail}`)
}

/**
 * Start the weekly report scheduler (checks every hour)
 */
export function startWeeklyReportScheduler() {
  console.log('[WeeklyReport] Starting weekly report scheduler...')

  setInterval(async () => {
    console.log('[WeeklyReport] Running weekly report check...')
    await sendWeeklyPerformanceReports()
  }, WEEKLY_REPORT_CHECK_INTERVAL_MS)

  // Also check on startup after 30 seconds
  setTimeout(async () => {
    await sendWeeklyPerformanceReports()
  }, 30000)

  console.log('[WeeklyReport] Weekly report scheduler started')
}
