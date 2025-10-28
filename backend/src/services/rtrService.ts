const RTR_API_KEY = process.env.RTR_API_KEY || 'c500f661b585b0ecb96e92c913ea37f92a6ec3a35d62581765708ebdfa30fcff'
const RTR_API_BASE_URL = 'https://ukrtwchecker.co.uk/api'

export interface RTRVerificationResult {
  verified: boolean
  firstName?: string
  lastName?: string
  dateOfBirth?: string
  nationality?: string
  immigrationStatus?: string
  workRestrictions?: string
  expiryDate?: string
  shareCode?: string
  errorMessage?: string
}

/**
 * Verify a Right to Rent share code with the UK RTW Checker API
 * @param shareCode The Home Office share code to verify
 * @param dateOfBirth Optional date of birth in YYYY-MM-DD format
 */
export async function verifyRTRShareCode(
  shareCode: string,
  dateOfBirth?: string
): Promise<RTRVerificationResult> {
  try {
    const response = await fetch(`${RTR_API_BASE_URL}/rtr/check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RTR_API_KEY}`
      },
      body: JSON.stringify({
        share_code: shareCode,
        date_of_birth: dateOfBirth
      })
    })

    if (!response.ok) {
      const errorData = await response.json() as any
      return {
        verified: false,
        errorMessage: errorData.message || 'Failed to verify Right to Rent'
      }
    }

    const data = await response.json() as any

    // Parse the API response based on UK RTW Checker API format
    if (data.status === 'success' && data.data) {
      return {
        verified: true,
        firstName: data.data.first_name,
        lastName: data.data.last_name,
        dateOfBirth: data.data.date_of_birth,
        nationality: data.data.nationality,
        immigrationStatus: data.data.immigration_status,
        workRestrictions: data.data.work_restrictions,
        expiryDate: data.data.expiry_date,
        shareCode: shareCode
      }
    } else {
      return {
        verified: false,
        errorMessage: data.message || 'Share code verification failed'
      }
    }
  } catch (error) {
    console.error('RTR verification error:', error)
    return {
      verified: false,
      errorMessage: 'An error occurred while verifying Right to Rent'
    }
  }
}
