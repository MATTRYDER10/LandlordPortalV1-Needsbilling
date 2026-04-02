import { ref, watch } from 'vue'

// Common domains for spell-check suggestions
const COMMON_DOMAINS = [
  'gmail.com',
  'yahoo.com',
  'yahoo.co.uk',
  'hotmail.com',
  'hotmail.co.uk',
  'outlook.com',
  'outlook.co.uk',
  'live.com',
  'live.co.uk',
  'icloud.com',
  'me.com',
  'aol.com',
  'mail.com',
  'protonmail.com',
  'proton.me',
  'btinternet.com',
  'sky.com',
  'virginmedia.com',
  'talktalk.net',
  'ntlworld.com',
  'msn.com',
  'googlemail.com',
  'ymail.com',
  'zoho.com',
]

// Common TLDs for the domain suffix check
const COMMON_TLDS = [
  '.com', '.co.uk', '.org', '.net', '.uk', '.io', '.me',
  '.org.uk', '.ac.uk', '.gov.uk',
]

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))

  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }

  return dp[m][n]
}

/**
 * Find the closest matching common domain
 */
function findClosestDomain(domain: string): string | null {
  let bestMatch: string | null = null
  let bestDistance = Infinity

  for (const common of COMMON_DOMAINS) {
    if (domain === common) return null // Exact match, no suggestion needed

    const distance = levenshtein(domain, common)
    // Only suggest if distance is 1-2 (close typo) and the domain is similar length
    if (distance > 0 && distance <= 2 && distance < bestDistance) {
      bestDistance = distance
      bestMatch = common
    }
  }

  return bestMatch
}

/**
 * Validate email format
 */
function isValidEmailFormat(email: string): boolean {
  if (!email) return true // Empty is not an error (required is handled separately)
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return re.test(email)
}

/**
 * Check for common issues
 */
function getEmailWarnings(email: string): string[] {
  if (!email || !email.includes('@')) return []

  const warnings: string[] = []
  const [local, domain] = email.split('@')

  if (!domain) return []

  // Check for spaces
  if (email.includes(' ')) {
    warnings.push('Email contains spaces')
    return warnings
  }

  // Check local part
  if (local.startsWith('.') || local.endsWith('.')) {
    warnings.push('Local part should not start or end with a dot')
  }

  // Check for missing TLD
  if (domain && !domain.includes('.')) {
    warnings.push('Domain appears to be missing a TLD (e.g. .com, .co.uk)')
  }

  // Check for double dots
  if (email.includes('..')) {
    warnings.push('Email contains consecutive dots')
  }

  return warnings
}

export interface EmailValidationResult {
  isValid: boolean
  error: string
  suggestion: string | null
  suggestedEmail: string | null
  warnings: string[]
}

/**
 * Validate an email and return suggestions
 */
export function validateEmail(email: string): EmailValidationResult {
  const trimmed = email.trim()

  if (!trimmed) {
    return { isValid: true, error: '', suggestion: null, suggestedEmail: null, warnings: [] }
  }

  // Format check
  if (!isValidEmailFormat(trimmed)) {
    return {
      isValid: false,
      error: 'Please enter a valid email address',
      suggestion: null,
      suggestedEmail: null,
      warnings: []
    }
  }

  const warnings = getEmailWarnings(trimmed)
  const [local, domain] = trimmed.split('@')

  // Domain spell check
  let suggestion: string | null = null
  let suggestedEmail: string | null = null

  if (domain) {
    const closestDomain = findClosestDomain(domain.toLowerCase())
    if (closestDomain) {
      suggestion = closestDomain
      suggestedEmail = `${local}@${closestDomain}`
    }
  }

  return {
    isValid: warnings.length === 0,
    error: warnings.length > 0 ? warnings[0] : '',
    suggestion,
    suggestedEmail,
    warnings
  }
}

/**
 * Composable for reactive email validation with debounce
 */
export function useEmailValidation(initialValue = '') {
  const email = ref(initialValue)
  const error = ref('')
  const suggestion = ref<string | null>(null)
  const suggestedEmail = ref<string | null>(null)
  const warnings = ref<string[]>([])

  let timeout: ReturnType<typeof setTimeout> | null = null

  function validate() {
    const result = validateEmail(email.value)
    error.value = result.error
    suggestion.value = result.suggestion
    suggestedEmail.value = result.suggestedEmail
    warnings.value = result.warnings
  }

  function applySuggestion() {
    if (suggestedEmail.value) {
      email.value = suggestedEmail.value
      suggestion.value = null
      suggestedEmail.value = null
    }
  }

  watch(email, () => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(validate, 400)
  })

  return {
    email,
    error,
    suggestion,
    suggestedEmail,
    warnings,
    validate,
    applySuggestion
  }
}
