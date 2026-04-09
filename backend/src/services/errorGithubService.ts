import { supabase } from '../config/supabase'

const GITHUB_REPO = 'CR88/PropertyGooseApp'
const MAX_NEW_ISSUES_PER_RUN = 10

interface ErrorGroup {
  fingerprint: string
  message: string
  source: string
  level: string
  error_type: string | null
  stack_trace: string | null
  route_name: string | null
  route_path: string | null
  request_method: string | null
  request_url: string | null
  component_name: string | null
  count: number
  first_seen: string
  latest: string
}

function getGithubToken(): string | null {
  return process.env.GITHUB_ISSUES_TOKEN || null
}

async function githubApi(path: string, options: RequestInit = {}): Promise<any> {
  const token = getGithubToken()
  if (!token) return null

  const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...options.headers,
    },
  })

  if (!response.ok) {
    const text = await response.text()
    console.error(`[ErrorGithub] GitHub API error (${response.status}): ${text}`)
    return null
  }

  return response.json()
}

function buildIssueTitle(group: ErrorGroup): string {
  const prefix = `[AUTO] `
  const errorType = group.error_type ? `${group.error_type}: ` : ''
  const maxLen = 200 - prefix.length
  const msg = `${errorType}${group.message}`
  return `${prefix}${msg.length > maxLen ? msg.substring(0, maxLen - 3) + '...' : msg}`
}

function buildIssueBody(group: ErrorGroup): string {
  let body = `## Auto-detected Error\n\n`
  body += `| Field | Value |\n|---|---|\n`
  body += `| **Source** | ${group.source} |\n`
  body += `| **Level** | ${group.level} |\n`
  body += `| **Type** | ${group.error_type || 'N/A'} |\n`
  body += `| **Occurrences** | ${group.count} |\n`
  body += `| **First seen** | ${group.first_seen} |\n`
  body += `| **Latest** | ${group.latest} |\n`

  if (group.route_name || group.route_path) {
    body += `| **Route** | ${group.route_name || ''} \`${group.route_path || ''}\` |\n`
  }
  if (group.component_name) {
    body += `| **Component** | ${group.component_name} |\n`
  }
  if (group.request_method && group.request_url) {
    body += `| **Request** | ${group.request_method} ${group.request_url} |\n`
  }

  body += `\n### Error Message\n\n\`\`\`\n${group.message}\n\`\`\`\n\n`

  if (group.stack_trace) {
    body += `### Stack Trace\n\n\`\`\`\n${group.stack_trace.substring(0, 3000)}\n\`\`\`\n\n`
  }

  body += `---\n`
  body += `<sub>Fingerprint: \`${group.fingerprint}\`</sub>\n`

  return body
}

function buildCommentBody(newCount: number, totalCount: number, latest: string): string {
  return `This error occurred **${newCount} more time${newCount === 1 ? '' : 's'}** (${totalCount} total). Latest: ${latest}`
}

/**
 * Process unlinked error logs and create/update GitHub issues.
 * Groups errors by fingerprint, deduplicates against existing issues.
 */
export async function processNewErrorsToGithub(): Promise<void> {
  const token = getGithubToken()
  if (!token) {
    return // Silently skip if no token configured
  }

  try {
    // Get unprocessed errors grouped by fingerprint
    const { data: unprocessedErrors, error: fetchError } = await supabase
      .from('error_logs')
      .select('fingerprint, message, source, level, error_type, stack_trace, route_name, route_path, request_method, request_url, component_name, created_at')
      .is('github_issue_number', null)
      .is('resolved_at', null)
      .order('created_at', { ascending: true })
      .limit(500)

    if (fetchError || !unprocessedErrors || unprocessedErrors.length === 0) {
      if (fetchError) console.error('[ErrorGithub] Failed to fetch errors:', fetchError.message)
      return
    }

    // Group by fingerprint
    const groups = new Map<string, ErrorGroup>()
    for (const err of unprocessedErrors) {
      const existing = groups.get(err.fingerprint)
      if (existing) {
        existing.count++
        existing.latest = err.created_at
      } else {
        groups.set(err.fingerprint, {
          fingerprint: err.fingerprint,
          message: err.message,
          source: err.source,
          level: err.level,
          error_type: err.error_type,
          stack_trace: err.stack_trace,
          route_name: err.route_name,
          route_path: err.route_path,
          request_method: err.request_method,
          request_url: err.request_url,
          component_name: err.component_name,
          count: 1,
          first_seen: err.created_at,
          latest: err.created_at,
        })
      }
    }

    let newIssuesCreated = 0

    for (const [fingerprint, group] of groups) {
      try {
        // Check if an existing error with this fingerprint already has an issue
        const { data: existingWithIssue } = await supabase
          .from('error_logs')
          .select('github_issue_number, github_issue_url')
          .eq('fingerprint', fingerprint)
          .not('github_issue_number', 'is', null)
          .limit(1)
          .maybeSingle()

        if (existingWithIssue?.github_issue_number) {
          // Issue already exists -- check if it's still open
          const issue = await githubApi(`/issues/${existingWithIssue.github_issue_number}`)

          if (issue) {
            if (issue.state === 'closed') {
              // Reopen with a comment
              await githubApi(`/issues/${existingWithIssue.github_issue_number}`, {
                method: 'PATCH',
                body: JSON.stringify({ state: 'open' }),
              })
              await githubApi(`/issues/${existingWithIssue.github_issue_number}/comments`, {
                method: 'POST',
                body: JSON.stringify({
                  body: `**Reopened** -- this error is recurring.\n\n${buildCommentBody(group.count, group.count, group.latest)}`,
                }),
              })
              console.log(`[ErrorGithub] Reopened issue #${existingWithIssue.github_issue_number} for fingerprint ${fingerprint.substring(0, 12)}`)
            } else {
              // Still open -- just add a comment with new count
              // Get total count for this fingerprint
              const { count: totalCount } = await supabase
                .from('error_logs')
                .select('id', { count: 'exact', head: true })
                .eq('fingerprint', fingerprint)

              await githubApi(`/issues/${existingWithIssue.github_issue_number}/comments`, {
                method: 'POST',
                body: JSON.stringify({
                  body: buildCommentBody(group.count, totalCount || group.count, group.latest),
                }),
              })
            }
          }

          // Stamp all unprocessed errors with this issue number
          await supabase
            .from('error_logs')
            .update({
              github_issue_number: existingWithIssue.github_issue_number,
              github_issue_url: existingWithIssue.github_issue_url,
            })
            .eq('fingerprint', fingerprint)
            .is('github_issue_number', null)

          continue
        }

        // No existing issue -- create a new one (respecting rate limit)
        if (newIssuesCreated >= MAX_NEW_ISSUES_PER_RUN) {
          console.warn(`[ErrorGithub] Hit max new issues per run (${MAX_NEW_ISSUES_PER_RUN}). Remaining fingerprints will be processed next run.`)
          break
        }

        const issue = await githubApi('/issues', {
          method: 'POST',
          body: JSON.stringify({
            title: buildIssueTitle(group),
            body: buildIssueBody(group),
            labels: ['bug', 'auto-error'],
          }),
        })

        if (!issue) {
          console.error(`[ErrorGithub] Failed to create issue for fingerprint ${fingerprint.substring(0, 12)}`)
          continue
        }

        console.log(`[ErrorGithub] Created issue #${issue.number} for fingerprint ${fingerprint.substring(0, 12)} (${group.count} occurrences)`)
        newIssuesCreated++

        // Stamp all errors with this fingerprint
        await supabase
          .from('error_logs')
          .update({
            github_issue_number: issue.number,
            github_issue_url: issue.html_url,
          })
          .eq('fingerprint', fingerprint)
          .is('github_issue_number', null)

      } catch (err: any) {
        console.error(`[ErrorGithub] Error processing fingerprint ${fingerprint.substring(0, 12)}:`, err.message)
      }
    }

    if (newIssuesCreated > 0) {
      console.log(`[ErrorGithub] Run complete: ${newIssuesCreated} new issues created, ${groups.size - newIssuesCreated} existing issues updated`)
    }
  } catch (err: any) {
    console.error('[ErrorGithub] Scheduler run failed:', err.message)
  }
}
