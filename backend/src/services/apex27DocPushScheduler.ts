/**
 * Apex27 Document Push Scheduler
 *
 * Runs daily at 2:00 AM UK time. For every company with Apex27 configured,
 * finds property_documents created since the last push and pushes them to
 * the matching Apex27 listing. Only pushes for properties that have an
 * apex27_listing_id (i.e. already synced with Apex27).
 *
 * Documents are marked as pushed via an `apex27_pushed_at` column on
 * property_documents so they're not re-pushed on the next run.
 */

import { supabase } from '../config/supabase'

const CHECK_INTERVAL_MS = 60 * 60 * 1000 // 1 hour
const TARGET_HOUR_UK = 2 // 2:00 AM UK time

let schedulerInterval: NodeJS.Timeout | null = null
let lastRunDate: string | null = null
let isRunning = false

export function startApex27DocPushScheduler(intervalMs: number = CHECK_INTERVAL_MS): void {
  if (schedulerInterval) {
    console.log('[Apex27DocPush] Already running')
    return
  }

  console.log(`[Apex27DocPush] Starting — checks hourly, fires daily at ${TARGET_HOUR_UK}:00 UK time`)

  setTimeout(() => runDailyPush(), 60 * 1000)
  schedulerInterval = setInterval(runDailyPush, intervalMs)
}

export function stopApex27DocPushScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval)
    schedulerInterval = null
    console.log('[Apex27DocPush] Stopped')
  }
}

async function runDailyPush(): Promise<void> {
  if (isRunning) return

  try {
    const now = new Date()
    const ukTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/London' }))
    const hour = ukTime.getHours()
    const todayStr = ukTime.toISOString().split('T')[0]

    if (hour !== TARGET_HOUR_UK) return
    if (lastRunDate === todayStr) return

    isRunning = true
    console.log(`[Apex27DocPush] Starting daily push for ${todayStr}`)

    const result = await pushNewDocuments()
    console.log(`[Apex27DocPush] Complete — pushed: ${result.pushed}, skipped: ${result.skipped}, failed: ${result.failed}`)

    lastRunDate = todayStr
  } catch (err) {
    console.error('[Apex27DocPush] Fatal error:', err)
  } finally {
    isRunning = false
  }
}

export async function pushNewDocuments(): Promise<{ pushed: number; skipped: number; failed: number }> {
  let pushed = 0
  let skipped = 0
  let failed = 0

  try {
    // Find all companies with Apex27 configured
    const { data: integrations } = await supabase
      .from('company_integrations')
      .select('company_id, apex27_api_key_encrypted')
      .not('apex27_api_key_encrypted', 'is', null)

    if (!integrations || integrations.length === 0) return { pushed, skipped, failed }

    const { decrypt } = await import('./encryption')
    const { pushDocument } = await import('./apex27Service')

    for (const integration of integrations) {
      const apiKey = decrypt(integration.apex27_api_key_encrypted)
      if (!apiKey) continue

      const companyId = integration.company_id

      // Find property_documents that haven't been pushed yet for properties
      // that have an apex27_listing_id
      const { data: docs, error: docsErr } = await supabase
        .from('property_documents')
        .select('id, file_name, file_path, property_id, properties!inner(apex27_listing_id)')
        .eq('company_id', companyId)
        .is('apex27_pushed_at', null)
        .not('file_path', 'is', null)
        .limit(100) // Cap per company per run

      if (docsErr) {
        console.error(`[Apex27DocPush] Error querying docs for ${companyId}:`, docsErr.message)
        continue
      }

      if (!docs || docs.length === 0) continue

      for (const doc of docs) {
        const listingId = (doc as any).properties?.apex27_listing_id
        if (!listingId) {
          skipped++
          continue
        }

        try {
          // Get a signed URL for the document (1 hour expiry — Apex27
          // downloads it immediately so this is plenty)
          const { data: signedData } = await supabase.storage
            .from('documents')
            .createSignedUrl(doc.file_path!, 3600)

          // Try property-documents bucket if documents bucket fails
          let url = signedData?.signedUrl
          if (!url) {
            const { data: altSigned } = await supabase.storage
              .from('property-documents')
              .createSignedUrl(doc.file_path!, 3600)
            url = altSigned?.signedUrl
          }

          if (!url) {
            console.warn(`[Apex27DocPush] No signed URL for doc ${doc.id} (${doc.file_path})`)
            skipped++
            continue
          }

          const result = await pushDocument(apiKey, {
            listingId: String(listingId),
            name: doc.file_name || 'Document',
            url,
          })

          if (result.success) {
            // Mark as pushed
            await supabase
              .from('property_documents')
              .update({ apex27_pushed_at: new Date().toISOString() })
              .eq('id', doc.id)
            pushed++
          } else {
            console.error(`[Apex27DocPush] Push failed for doc ${doc.id}:`, result.error)
            failed++
          }
        } catch (err: any) {
          console.error(`[Apex27DocPush] Error pushing doc ${doc.id}:`, err?.message || err)
          failed++
        }
      }
    }
  } catch (err) {
    console.error('[Apex27DocPush] Unexpected error:', err)
  }

  return { pushed, skipped, failed }
}
