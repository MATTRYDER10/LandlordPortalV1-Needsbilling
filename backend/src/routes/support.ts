import { Router, Response } from 'express'
import { authenticateToken, AuthRequest, getCompanyIdForRequest } from '../middleware/auth'
import { supabase } from '../config/supabase'
import { decrypt } from '../services/encryption'
import { sendEmail, loadEmailTemplate } from '../services/emailService'

const router = Router()

interface SupportReportBody {
  page: string
  title: string
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  entityType?: string
  entityId?: string
  entityLabel?: string
  screenshots?: string[] // base64 encoded images
}

/**
 * POST /api/support/report
 * Submit an IT support / bug report issue
 */
router.post('/report', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id
    const userEmail = req.user?.email
    if (!userId || !userEmail) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const {
      page,
      title,
      description,
      severity,
      entityType,
      entityId,
      entityLabel,
      screenshots
    } = req.body as SupportReportBody

    // Validate required fields
    if (!title || !description || !severity) {
      return res.status(400).json({ error: 'Title, description, and severity are required' })
    }

    const validSeverities = ['low', 'medium', 'high', 'critical']
    if (!validSeverities.includes(severity)) {
      return res.status(400).json({ error: 'Invalid severity level' })
    }

    // Get company info for context
    const companyId = await getCompanyIdForRequest(req)
    let companyName = 'Unknown'
    if (companyId) {
      const { data: company } = await supabase
        .from('companies')
        .select('*')
        .eq('id', companyId)
        .maybeSingle()
      if (company) {
        const co = company as any
        companyName = co.name || (co.name_encrypted ? decrypt(co.name_encrypted) : null) || co.company_name || 'Unknown'
      }
    }

    // Upload screenshots to Supabase Storage if provided
    const screenshotUrls: string[] = []
    if (screenshots && screenshots.length > 0) {
      const maxScreenshots = Math.min(screenshots.length, 3)
      for (let i = 0; i < maxScreenshots; i++) {
        try {
          const base64Data = screenshots[i]!
          // Extract mime type and data from base64 string
          const matches = base64Data.match(/^data:(.+);base64,(.+)$/)
          if (!matches) continue

          const mimeType = matches[1]!
          const data = matches[2]!
          const extension = mimeType.split('/')[1] || 'png'
          const fileName = `support-screenshots/${Date.now()}-${i}.${extension}`

          const buffer = Buffer.from(data, 'base64')

          const { error: uploadError } = await supabase.storage
            .from('documents')
            .upload(fileName, buffer, {
              contentType: mimeType,
              upsert: false
            })

          if (uploadError) {
            console.error(`[Support] Screenshot upload failed:`, uploadError.message)
            continue
          }

          const { data: urlData } = supabase.storage
            .from('documents')
            .getPublicUrl(fileName)

          if (urlData?.publicUrl) {
            screenshotUrls.push(urlData.publicUrl)
          }
        } catch (err) {
          console.error(`[Support] Error processing screenshot ${i}:`, err)
        }
      }
    }

    // Build GitHub issue body
    const severityEmoji: Record<string, string> = {
      low: '🟢',
      medium: '🟡',
      high: '🟠',
      critical: '🔴'
    }

    let issueBody = `## Bug Report\n\n`
    issueBody += `**Reported by:** ${userEmail}\n`
    issueBody += `**Company:** ${companyName}\n`
    issueBody += `**Page:** ${page || 'Not specified'}\n`
    issueBody += `**Severity:** ${severityEmoji[severity] || ''} ${severity.charAt(0).toUpperCase() + severity.slice(1)}\n`
    issueBody += `**Date:** ${new Date().toISOString()}\n\n`

    if (entityType && entityLabel) {
      issueBody += `### Linked Entity\n`
      issueBody += `- **Type:** ${entityType}\n`
      issueBody += `- **Label:** ${entityLabel}\n`
      if (entityId) issueBody += `- **ID:** ${entityId}\n`
      issueBody += `\n`
    }

    issueBody += `### Description\n\n${description}\n\n`

    if (screenshotUrls.length > 0) {
      issueBody += `### Screenshots\n\n`
      screenshotUrls.forEach((url, i) => {
        issueBody += `![Screenshot ${i + 1}](${url})\n\n`
      })
    }

    // Create GitHub issue
    const githubToken = process.env.GITHUB_ISSUES_TOKEN
    if (!githubToken) {
      console.error('[Support] GITHUB_ISSUES_TOKEN not configured')
      return res.status(500).json({ error: 'GitHub integration not configured' })
    }

    const githubResponse = await fetch('https://api.github.com/repos/CR88/PropertyGooseApp/issues', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28'
      },
      body: JSON.stringify({
        title: `[${severity.toUpperCase()}] ${title}`,
        body: issueBody,
        labels: ['bug', 'user-reported', `severity:${severity}`]
      })
    })

    if (!githubResponse.ok) {
      const errorText = await githubResponse.text()
      console.error('[Support] GitHub issue creation failed:', errorText)
      return res.status(500).json({ error: 'Failed to create issue on GitHub' })
    }

    const githubIssue = await githubResponse.json() as { number: number; html_url: string }
    const issueNumber = githubIssue.number
    const issueUrl = githubIssue.html_url

    console.log(`[Support] GitHub issue #${issueNumber} created: ${issueUrl}`)

    // Send confirmation email to user
    try {
      const confirmationHtml = loadEmailTemplate('support-issue-confirmation', {
        Title: title,
        IssueNumber: String(issueNumber),
        Severity: severity.charAt(0).toUpperCase() + severity.slice(1),
        Description: description,
        Page: page || 'Not specified'
      })

      await sendEmail({
        to: userEmail,
        subject: `Support Issue #${issueNumber} Received - ${title}`,
        html: confirmationHtml
      })
    } catch (emailErr) {
      console.error('[Support] Failed to send confirmation email:', emailErr)
      // Don't fail the request if email fails
    }

    // Send notification email to info@propertygoose.co.uk
    try {
      const notificationHtml = loadEmailTemplate('support-issue-notification', {
        Title: title,
        IssueNumber: String(issueNumber),
        IssueUrl: issueUrl,
        Severity: severity.charAt(0).toUpperCase() + severity.slice(1),
        Description: description,
        Page: page || 'Not specified',
        UserEmail: userEmail,
        CompanyName: companyName,
        EntityInfo: entityType && entityLabel ? `${entityType}: ${entityLabel}` : 'None',
        ScreenshotCount: String(screenshotUrls.length)
      })

      await sendEmail({
        to: 'info@propertygoose.co.uk',
        subject: `[${severity.toUpperCase()}] Support Issue #${issueNumber} - ${title}`,
        html: notificationHtml
      })
    } catch (emailErr) {
      console.error('[Support] Failed to send notification email:', emailErr)
    }

    res.json({
      success: true,
      issueNumber,
      issueUrl
    })
  } catch (error: any) {
    console.error('[Support] Error creating support report:', error)
    res.status(500).json({ error: error.message || 'Failed to submit support report' })
  }
})

/**
 * GitHub Webhook - Issue Closed
 * When an issue with 'user-reported' label is closed on GitHub,
 * send a resolution email to the reporter
 */
router.post('/github-webhook', async (req, res) => {
  try {
    const { action, issue } = req.body

    // Only handle issue close events
    if (action !== 'closed' || !issue) {
      return res.json({ ignored: true })
    }

    // Only process user-reported issues
    const labels = (issue.labels || []).map((l: any) => l.name)
    if (!labels.includes('user-reported')) {
      return res.json({ ignored: true, reason: 'not user-reported' })
    }

    // Extract reporter email from issue body
    const emailMatch = issue.body?.match(/\*\*Reported by:\*\*\s*(\S+@\S+)/)
    if (!emailMatch) {
      return res.json({ ignored: true, reason: 'no reporter email found' })
    }

    const reporterEmail = emailMatch[1]
    const issueTitle = issue.title?.replace('[Support] ', '') || 'Your reported issue'

    // Send resolution email
    const html = loadEmailTemplate('support-issue-resolved', {
      IssueTitle: issueTitle,
      IssueNumber: String(issue.number),
      IssueUrl: issue.html_url || ''
    })

    await sendEmail({
      to: reporterEmail,
      subject: `Issue Resolved: ${issueTitle} - PropertyGoose`,
      html
    })

    console.log(`[Support] Resolution email sent to ${reporterEmail} for issue #${issue.number}`)
    res.json({ success: true, emailSent: reporterEmail })
  } catch (error: any) {
    console.error('[Support] Webhook error:', error)
    res.status(200).json({ error: error.message }) // Always 200 for webhooks
  }
})

export default router
