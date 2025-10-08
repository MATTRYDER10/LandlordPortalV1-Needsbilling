import crypto from 'crypto'

// Encryption configuration
const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const SALT_LENGTH = 64
const TAG_LENGTH = 16
const TAG_POSITION = SALT_LENGTH + IV_LENGTH
const ENCRYPTED_POSITION = TAG_POSITION + TAG_LENGTH

/**
 * Get encryption key from environment variable
 * Key must be 32 bytes (256 bits) for AES-256
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY

  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set')
  }

  // Convert base64 key to buffer
  return Buffer.from(key, 'base64')
}

/**
 * Encrypt a string value using AES-256-GCM
 * Returns base64-encoded encrypted data with salt, IV, and auth tag
 */
export function encrypt(plaintext: string | null): string | null {
  if (!plaintext) return null

  try {
    const key = getEncryptionKey()

    // Generate random IV (no longer need salt since we use key directly)
    const salt = Buffer.alloc(SALT_LENGTH) // Empty salt for format compatibility
    const iv = crypto.randomBytes(IV_LENGTH)

    // Create cipher using master key directly (no PBKDF2 needed for strong keys)
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

    // Encrypt the data
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final()
    ])

    // Get authentication tag
    const tag = cipher.getAuthTag()

    // Combine salt + IV + tag + encrypted data
    const combined = Buffer.concat([salt, iv, tag, encrypted])

    // Return as base64 string
    return combined.toString('base64')
  } catch (error) {
    console.error('Encryption error:', error)
    throw new Error('Failed to encrypt data')
  }
}

/**
 * Decrypt a string value encrypted with AES-256-GCM
 * Expects base64-encoded data with salt, IV, and auth tag
 * Supports multiple formats: direct key (newest/fastest), 10k iterations, 100k iterations (legacy)
 */
export function decrypt(encryptedData: string | null): string | null {
  if (!encryptedData) return null

  const key = getEncryptionKey()

  // Convert from base64
  const combined = Buffer.from(encryptedData, 'base64')

  // Extract components
  const salt = combined.subarray(0, SALT_LENGTH)
  const iv = combined.subarray(SALT_LENGTH, TAG_POSITION)
  const tag = combined.subarray(TAG_POSITION, ENCRYPTED_POSITION)
  const encrypted = combined.subarray(ENCRYPTED_POSITION)

  // Try newest format first (direct key - fastest, ~100x faster than legacy)
  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(tag)

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ])

    return decrypted.toString('utf8')
  } catch (error) {
    // Try 10k iterations format
    try {
      const derivedKey = crypto.pbkdf2Sync(key, salt, 10000, 32, 'sha512')
      const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv)
      decipher.setAuthTag(tag)

      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
      ])

      return decrypted.toString('utf8')
    } catch (error2) {
      // Try legacy 100k iterations format for backward compatibility
      try {
        const derivedKey = crypto.pbkdf2Sync(key, salt, 100000, 32, 'sha512')
        const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv)
        decipher.setAuthTag(tag)

        const decrypted = Buffer.concat([
          decipher.update(encrypted),
          decipher.final()
        ])

        return decrypted.toString('utf8')
      } catch (legacyError) {
        console.error('Decryption error:', legacyError)
        throw new Error('Failed to decrypt data')
      }
    }
  }
}

/**
 * Hash a value using SHA-256
 * Used for one-way hashing of tokens
 */
export function hash(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex')
}

/**
 * Generate a cryptographically secure random token
 * @param bytes Number of random bytes (default: 32)
 * @returns Hex string of random bytes
 */
export function generateToken(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString('hex')
}
