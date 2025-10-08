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

    // Generate random salt and IV
    const salt = crypto.randomBytes(SALT_LENGTH)
    const iv = crypto.randomBytes(IV_LENGTH)

    // Derive key using PBKDF2
    const derivedKey = crypto.pbkdf2Sync(key, salt, 10000, 32, 'sha512')

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv)

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
 */
export function decrypt(encryptedData: string | null): string | null {
  if (!encryptedData) return null

  try {
    const key = getEncryptionKey()

    // Convert from base64
    const combined = Buffer.from(encryptedData, 'base64')

    // Extract components
    const salt = combined.subarray(0, SALT_LENGTH)
    const iv = combined.subarray(SALT_LENGTH, TAG_POSITION)
    const tag = combined.subarray(TAG_POSITION, ENCRYPTED_POSITION)
    const encrypted = combined.subarray(ENCRYPTED_POSITION)

    // Derive key using same parameters as encryption
    const derivedKey = crypto.pbkdf2Sync(key, salt, 10000, 32, 'sha512')

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv)
    decipher.setAuthTag(tag)

    // Decrypt the data
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ])

    return decrypted.toString('utf8')
  } catch (error) {
    console.error('Decryption error:', error)
    throw new Error('Failed to decrypt data')
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
