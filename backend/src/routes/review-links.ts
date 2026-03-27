import { Router } from 'express'
import { authenticateToken, requireMember, AuthRequest, getCompanyIdForRequest } from '../middleware/auth'
import { supabase } from '../config/supabase'
import { decrypt } from '../services/encryption'
import { sendEmail } from '../services/emailService'

const router = Router()

// GET /api/review-links/settings - Get review link settings for current company/branch
router.get('/settings', authenticateToken, requireMember, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)

    if (!companyId) {
      return res.status(400).json({ error: 'Company not found' })
    }

    const { data: company } = await supabase
      .from('companies')
      .select('review_link, review_platform')
      .eq('id', companyId)
      .single()

    res.json({
      review_link: company?.review_link || null,
      review_platform: company?.review_platform || null
    })
  } catch (error: any) {
    console.error('Error fetching review link settings:', error)
    res.status(500).json({ error: 'Failed to fetch settings' })
  }
})

// POST /api/review-links/settings - Save review link settings
router.post('/settings', authenticateToken, requireMember, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    const { review_link, review_platform } = req.body

    if (!companyId) {
      return res.status(400).json({ error: 'Company not found' })
    }

    // Update company
    const { error } = await supabase
      .from('companies')
      .update({
        review_link: review_link || null,
        review_platform: review_platform || null
      })
      .eq('id', companyId)

    if (error) {
      console.error('Error saving review link settings:', error)
      return res.status(500).json({ error: 'Failed to save settings' })
    }

    res.json({ success: true })
  } catch (error: any) {
    console.error('Error saving review link settings:', error)
    res.status(500).json({ error: 'Failed to save settings' })
  }
})

// POST /api/review-links/send - Send review request to tenant(s)
router.post('/send', authenticateToken, requireMember, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    const { tenancy_id, tenant_emails, agent_note } = req.body

    if (!companyId) {
      return res.status(400).json({ error: 'Company not found' })
    }

    // Get company review link
    const { data: companyData } = await supabase
      .from('companies')
      .select('review_link, review_platform')
      .eq('id', companyId)
      .single()

    const reviewLink = companyData?.review_link
    const reviewPlatform = companyData?.review_platform

    if (!reviewLink) {
      return res.status(400).json({ error: 'No review link configured. Please set up your review link in Settings.' })
    }

    // Get company info for email
    const { data: company } = await supabase
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .maybeSingle()

    // Get tenancy info
    const { data: tenancy } = await supabase
      .from('tenancies')
      .select('property_address, property_city')
      .eq('id', tenancy_id)
      .single()

    const rlCo = company as any
    const companyName = rlCo?.name || (rlCo?.name_encrypted ? decrypt(rlCo.name_encrypted) : null) || rlCo?.company_name || 'PropertyGoose'
    const propertyAddress = tenancy?.property_address || 'your property'
    const logoUrl = company?.logo_url || 'https://app.propertygoose.co.uk/PropertyGooseLogo.png'
    const primaryColor = company?.primary_color || '#f97316'

    // Determine platform display name
    const platformName = reviewPlatform === 'google' ? 'Google'
      : reviewPlatform === 'trustpilot' ? 'Trustpilot'
      : 'our review page'

    // Send to each tenant
    const emails = Array.isArray(tenant_emails) ? tenant_emails : [tenant_emails]
    let sentCount = 0

    for (const email of emails) {
      try {
        const html = generateReviewEmailHtml({
          companyName,
          propertyAddress,
          reviewLink,
          platformName,
          logoUrl,
          primaryColor,
          agentNote: agent_note
        })

        await sendEmail({
          to: email,
          subject: `We'd love your feedback - ${companyName}`,
          html
        })
        sentCount++
      } catch (emailError) {
        console.error(`Failed to send review email to ${email}:`, emailError)
      }
    }

    // Log activity
    if (tenancy_id) {
      await supabase.from('tenancy_activity').insert({
        tenancy_id,
        activity_type: 'review_request_sent',
        description: `Review request sent to ${sentCount} tenant(s)`,
        created_by: req.user?.id
      })
    }

    res.json({
      success: true,
      sent_count: sentCount,
      total: emails.length
    })
  } catch (error: any) {
    console.error('Error sending review request:', error)
    res.status(500).json({ error: 'Failed to send review request' })
  }
})

function generateReviewEmailHtml(params: {
  companyName: string
  propertyAddress: string
  reviewLink: string
  platformName: string
  logoUrl: string
  primaryColor: string
  agentNote?: string
}): string {
  const { companyName, propertyAddress, reviewLink, platformName, logoUrl, primaryColor, agentNote } = params

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>We'd Love Your Feedback - ${companyName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f3f4f6;">
        <tr>
            <td style="padding: 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">

                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, ${primaryColor} 0%, #ea580c 100%); padding: 30px 40px; text-align: center;">
                            <img src="${logoUrl}" alt="${companyName}" style="max-height: 50px; max-width: 200px; margin-bottom: 16px;" />
                            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">We'd Love Your Feedback!</h1>
                        </td>
                    </tr>

                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px;">
                            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                Dear Tenant,
                            </p>

                            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                Thank you for being a valued tenant at <strong>${propertyAddress}</strong>. We hope your experience with ${companyName} has been positive.
                            </p>

                            ${agentNote ? `
                            <div style="background-color: #fef3c7; border-left: 4px solid ${primaryColor}; padding: 16px 20px; margin: 0 0 20px 0; border-radius: 0 8px 8px 0;">
                                <p style="color: #92400e; font-size: 15px; line-height: 1.6; margin: 0; font-style: italic;">
                                    "${agentNote}"
                                </p>
                            </div>
                            ` : ''}

                            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                                We would really appreciate it if you could take a moment to share your experience on ${platformName}. Your feedback helps us improve and helps others find quality letting services.
                            </p>

                            <!-- CTA Button -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td style="text-align: center;">
                                        <a href="${reviewLink}"
                                           style="display: inline-block; padding: 16px 40px; background-color: ${primaryColor}; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">
                                            Leave a Review ⭐
                                        </a>
                                    </td>
                                </tr>
                            </table>

                            <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0; text-align: center;">
                                It only takes a minute and means the world to us!
                            </p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f9fafb; padding: 24px 40px; border-top: 1px solid #e5e7eb;">
                            <p style="color: #6b7280; font-size: 13px; margin: 0; text-align: center;">
                                Thank you for choosing <strong>${companyName}</strong>
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
`
}

export default router
