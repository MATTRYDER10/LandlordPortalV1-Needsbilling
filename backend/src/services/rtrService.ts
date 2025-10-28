const RTR_API_KEY = process.env.RTR_API_KEY || 'c500f661b585b0ecb96e92c913ea37f92a6ec3a35d62581765708ebdfa30fcff'
const RTR_API_BASE_URL = 'https://app.ukrtwchecker.co.uk'

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

export interface RTRVerificationRequest {
  shareCode: string
  dateOfBirth: string // DD-MM-YYYY format
  firstName: string
  lastName: string
  checkerType: 'landlord' | 'agent'
  checkerName: string
}

/**
 * Verify a Right to Rent share code with the UK RTW Checker API
 * @param request The RTR verification request with all required fields
 */
export async function verifyRTRShareCode(
  request: RTRVerificationRequest
): Promise<RTRVerificationResult> {
  try {
    // Build query parameters
    const params = new URLSearchParams({
      code: request.shareCode,
      dob: request.dateOfBirth,
      forename: request.firstName,
      surname: request.lastName,
      checker_type: request.checkerType,
      checker_name: request.checkerName
    })

    const response = await fetch(`${RTR_API_BASE_URL}/rtr?${params.toString()}`, {
      method: 'GET',
      headers: {
        'X-UKRTWAPI-SECRET': RTR_API_KEY
      }
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
    // Response format: { code: 200, status: { outcome: "ACCEPTED", details: "...", expiry_date: "...", ... } }
    if (data.code === 200 && data.status) {
      const status = data.status
      const isAccepted = status.outcome === 'ACCEPTED'

      return {
        verified: isAccepted,
        firstName: request.firstName,
        lastName: request.lastName,
        dateOfBirth: request.dateOfBirth,
        nationality: status.nationality,
        immigrationStatus: status.details || status.conditions,
        workRestrictions: status.conditions,
        expiryDate: status.expiry_date,
        shareCode: request.shareCode,
        errorMessage: !isAccepted ? `Verification outcome: ${status.outcome}` : undefined
      }
    } else {
      return {
        verified: false,
        errorMessage: data.message || data.error || 'Share code verification failed'
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
