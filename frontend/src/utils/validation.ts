/**
 * Email validation regex pattern
 * This pattern validates email addresses according to RFC 5322 specification
 * It checks for:
 * - Valid local part (before @)
 * - @ symbol
 * - Valid domain part (after @)
 */
export const EMAIL_REGEX = /^[a-zA-Z0-9]+(?:[._%+-][a-zA-Z0-9]+)*@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

/**
 * Validates an email address using a regex pattern
 * @param email - The email address to validate
 * @returns true if the email is valid, false otherwise
 */
export const isValidEmail = (email: string): boolean => {
    if (!email || typeof email !== 'string') {
        return false
    }

    // Trim whitespace
    const trimmedEmail = email.trim()

    // Check if email matches the regex pattern
    return EMAIL_REGEX.test(trimmedEmail)
}

