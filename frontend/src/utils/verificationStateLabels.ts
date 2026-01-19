/**
 * Verification State Display Labels and Colors
 *
 * Maps database verification_state values to user-friendly labels and colors
 * Part of Phase 5-6 simplification (replaces complex derived statuses)
 */

export type VerificationState =
  | 'SENT'
  | 'COLLECTING_EVIDENCE'
  | 'WAITING_ON_REFERENCES'
  | 'READY_FOR_REVIEW'
  | 'IN_VERIFICATION'
  | 'ACTION_REQUIRED'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED'

/**
 * Get user-friendly display label for verification state
 */
export function getVerificationStateLabel(state: VerificationState | string | null | undefined): string {
  if (!state) return 'Not Started'

  const labels: Record<string, string> = {
    SENT: 'Sent',
    COLLECTING_EVIDENCE: 'In Progress',
    WAITING_ON_REFERENCES: 'Awaiting References',
    READY_FOR_REVIEW: 'Ready for Verification',
    IN_VERIFICATION: 'Being Verified',
    ACTION_REQUIRED: 'Action Required',
    COMPLETED: 'Verified',
    REJECTED: 'Failed Verification',
    CANCELLED: 'Cancelled'
  }

  return labels[state] || state
}

/**
 * Get Tailwind color class for verification state badges
 */
export function getVerificationStateColor(state: VerificationState | string | null | undefined): string {
  if (!state) return 'gray'

  const colors: Record<string, string> = {
    SENT: 'gray',
    COLLECTING_EVIDENCE: 'blue',
    WAITING_ON_REFERENCES: 'yellow',
    READY_FOR_REVIEW: 'purple',
    IN_VERIFICATION: 'purple',
    ACTION_REQUIRED: 'orange',
    COMPLETED: 'green',
    REJECTED: 'red',
    CANCELLED: 'gray'
  }

  return colors[state] || 'gray'
}

/**
 * Get icon for verification state (optional, for enhanced UI)
 */
export function getVerificationStateIcon(state: VerificationState | string | null | undefined): string {
  if (!state) return '⏳'

  const icons: Record<string, string> = {
    SENT: '✉️',
    COLLECTING_EVIDENCE: '📝',
    WAITING_ON_REFERENCES: '⏳',
    READY_FOR_REVIEW: '👀',
    IN_VERIFICATION: '🔍',
    ACTION_REQUIRED: '⚠️',
    COMPLETED: '✅',
    REJECTED: '❌',
    CANCELLED: '🚫'
  }

  return icons[state] || '❓'
}

/**
 * Check if state requires user action
 */
export function requiresUserAction(state: VerificationState | string | null | undefined): boolean {
  return state === 'COLLECTING_EVIDENCE' || state === 'ACTION_REQUIRED'
}

/**
 * Check if state is terminal (no further changes expected)
 */
export function isTerminalState(state: VerificationState | string | null | undefined): boolean {
  return state === 'COMPLETED' || state === 'REJECTED' || state === 'CANCELLED'
}

/**
 * Get progress percentage for state (for progress bars)
 */
export function getStateProgress(state: VerificationState | string | null | undefined): number {
  const progress: Record<string, number> = {
    SENT: 5,
    COLLECTING_EVIDENCE: 20,
    WAITING_ON_REFERENCES: 40,
    READY_FOR_REVIEW: 60,
    IN_VERIFICATION: 80,
    ACTION_REQUIRED: 30,  // Back to earlier stage
    COMPLETED: 100,
    REJECTED: 100,
    CANCELLED: 100
  }

  return progress[state || ''] || 0
}
