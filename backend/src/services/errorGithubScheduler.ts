import { processNewErrorsToGithub } from './errorGithubService'

const INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

export function startErrorGithubScheduler(): void {
  console.log('[ErrorGithub] Scheduler started (every 5 minutes)')

  // Initial run after 30 second delay (let server fully start)
  setTimeout(() => {
    processNewErrorsToGithub()
  }, 30_000)

  // Recurring runs
  setInterval(() => {
    processNewErrorsToGithub()
  }, INTERVAL_MS)
}
