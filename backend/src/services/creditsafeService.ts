import axios, { AxiosInstance } from 'axios'
import { supabase } from '../config/supabase'
import { encrypt, decrypt } from './encryption'

interface CreditsafeConfig {
  apiUrl: string
  username: string
  password: string
  enabled: boolean
}

interface VerificationRequest {
  firstName: string
  lastName: string
  middleName?: string
  dateOfBirth: string // Format: YYYY-MM-DD
  address: string // Full address
  postcode: string
}

interface VerificationResponse {
  status: 'passed' | 'failed' | 'refer' | 'error'
  verifyMatch: boolean

  // Flags from Creditsafe
  ccjMatch?: boolean
  electoralRegisterMatch?: boolean
  deceasedRegisterMatch?: boolean
  insolvencyMatch?: boolean

  // Detailed data
  countyCourtJudgments?: any[]
  electoralRolls?: any[]
  insolvencies?: any[]

  // Risk assessment
  riskLevel?: 'low' | 'medium' | 'high' | 'very_high'
  riskScore?: number

  // Metadata
  transactionId?: string
  errorMessage?: string
  rawResponse?: any
}

class CreditsafeService {
  private config: CreditsafeConfig
  private authToken: string | null = null
  private tokenExpiry: Date | null = null
  private axiosInstance: AxiosInstance

  constructor() {
    this.config = {
      apiUrl: process.env.CREDITSAFE_API_URL || 'https://connect.creditsafe.com/v1',
      username: process.env.CREDITSAFE_USERNAME || '',
      password: process.env.CREDITSAFE_PASSWORD || '',
      enabled: process.env.CREDITSAFE_ENABLED === 'true'
    }

    // Debug: Log configuration (hide password)
    console.log('Creditsafe config:', {
      apiUrl: this.config.apiUrl,
      username: this.config.username,
      passwordLength: this.config.password?.length || 0,
      enabled: this.config.enabled
    })

    this.axiosInstance = axios.create({
      baseURL: this.config.apiUrl,
      timeout: 30000, // 30 second timeout
      headers: {
        'Content-Type': 'application/json'
      }
    })
  }

  /**
   * Check if Creditsafe integration is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled && !!this.config.username && !!this.config.password
  }

  /**
   * Authenticate with Creditsafe API and get access token
   */
  private async authenticate(): Promise<string> {
    try {
      // Check if we have a valid token
      if (this.authToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
        return this.authToken
      }

      console.log('Authenticating with Creditsafe API...')

      const response = await this.axiosInstance.post('/authenticate', {
        username: this.config.username,
        password: this.config.password
      })

      if (response.data && response.data.token) {
        this.authToken = response.data.token
        // Token typically expires in 1 hour, set expiry to 50 minutes to be safe
        this.tokenExpiry = new Date(Date.now() + 50 * 60 * 1000)
        console.log('Creditsafe authentication successful')
        return this.authToken as string
      }

      throw new Error('Failed to get authentication token from Creditsafe')
    } catch (error: any) {
      console.error('Creditsafe authentication error:', error.response?.data || error.message)
      throw new Error(`Creditsafe authentication failed: ${error.response?.data?.message || error.message}`)
    }
  }

  /**
   * Verify individual using Creditsafe Verify API
   * Checks Electoral Roll, CCJs, Insolvencies
   */
  async verifyIndividual(request: VerificationRequest): Promise<VerificationResponse> {
    if (!this.isEnabled()) {
      console.log('Creditsafe verification is disabled')
      return {
        status: 'error',
        verifyMatch: false,
        errorMessage: 'Creditsafe verification is not enabled'
      }
    }

    try {
      // Get authentication token
      const token = await this.authenticate()

      console.log('Sending Verify request to Creditsafe for:', request.firstName, request.lastName)

      // Call Creditsafe Verify API - Direct Individual Report endpoint
      const response = await this.axiosInstance.get('/localSolutions/GB/verify/individual/directReport', {
        params: {
          firstName: request.firstName,
          lastName: request.lastName,
          dateOfBirth: request.dateOfBirth,
          address: request.address,
          postCode: request.postcode,
          reasonForSearch: 'TV' // TV = Tenant Vetting
        },
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      console.log('Creditsafe verification completed:', response.data.verifyMatch ? 'Match found' : 'No match')

      // Parse and return verification response
      return this.parseVerificationResponse(response.data)
    } catch (error: any) {
      console.error('Creditsafe verification error:', error.response?.data || error.message)
      return {
        status: 'error',
        verifyMatch: false,
        errorMessage: error.response?.data?.message || error.message,
        rawResponse: error.response?.data
      }
    }
  }

  /**
   * Parse Creditsafe Verify API response and assess risk
   */
  private parseVerificationResponse(apiResponse: any): VerificationResponse {
    try {
      const result: VerificationResponse = {
        status: 'refer',
        verifyMatch: apiResponse.verifyMatch || false,
        rawResponse: apiResponse,
        transactionId: apiResponse.correlationId
      }

      // Extract flags
      if (apiResponse.flags) {
        result.ccjMatch = apiResponse.flags.ccjMatch
        result.electoralRegisterMatch = apiResponse.flags.electoralRegisterMatch
        result.deceasedRegisterMatch = apiResponse.flags.deceasedRegisterMatch
        result.insolvencyMatch = apiResponse.flags.insolvencyMatch
      }

      // Extract detailed data
      result.countyCourtJudgments = apiResponse.countyCourtJudgments || []
      result.electoralRolls = apiResponse.electoralRolls || []
      result.insolvencies = apiResponse.insolvencies || []

      // Calculate risk level and score
      const riskAssessment = this.assessRisk(apiResponse)
      result.riskLevel = riskAssessment.level
      result.riskScore = riskAssessment.score

      // Determine overall status
      if (!apiResponse.verifyMatch) {
        result.status = 'failed' // No match found
      } else if (riskAssessment.level === 'low') {
        result.status = 'passed' // Low risk, good tenant
      } else if (riskAssessment.level === 'medium') {
        result.status = 'refer' // Needs manual review
      } else {
        result.status = 'failed' // High/very high risk
      }

      return result
    } catch (error) {
      console.error('Error parsing Creditsafe response:', error)
      return {
        status: 'error',
        verifyMatch: false,
        errorMessage: 'Failed to parse Creditsafe API response',
        rawResponse: apiResponse
      }
    }
  }

  /**
   * Assess risk based on Creditsafe Verify data
   */
  private assessRisk(data: any): { level: 'low' | 'medium' | 'high' | 'very_high', score: number } {
    let score = 100 // Start with perfect score

    // Check if deceased (immediate red flag)
    if (data.flags?.deceasedRegisterMatch === true) {
      return { level: 'very_high', score: 0 }
    }

    // Electoral roll check (-30 points if not on roll)
    if (data.flags?.electoralRegisterMatch === false) {
      score -= 30
    }

    // CCJ checks
    const ccjs = data.countyCourtJudgments || []
    if (ccjs.length > 0) {
      score -= 20 * Math.min(ccjs.length, 3) // -20 per CCJ, max -60

      // Additional penalty for recent or unpaid CCJs
      const recentCCJs = ccjs.filter((ccj: any) => {
        if (!ccj.date) return false
        const ccjDate = new Date(ccj.date)
        const threeYearsAgo = new Date()
        threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3)
        return ccjDate > threeYearsAgo
      })

      if (recentCCJs.length > 0) {
        score -= 15 // Recent CCJs are worse
      }

      const unpaidCCJs = ccjs.filter((ccj: any) => !ccj.paidDate)
      if (unpaidCCJs.length > 0) {
        score -= 15 // Unpaid CCJs are worse
      }
    }

    // Insolvency checks
    if (data.flags?.insolvencyMatch === true) {
      const insolvencies = data.insolvencies || []
      score -= 40 * Math.min(insolvencies.length, 2) // -40 per insolvency
    }

    // Determine risk level
    score = Math.max(0, score) // Can't go below 0

    if (score >= 80) return { level: 'low', score }
    if (score >= 60) return { level: 'medium', score }
    if (score >= 40) return { level: 'high', score }
    return { level: 'very_high', score }
  }

  /**
   * Store verification result in database
   */
  async storeVerificationResult(
    referenceId: string,
    request: VerificationRequest,
    response: VerificationResponse,
    requestedBy?: string
  ): Promise<string | null> {
    try {
      // Encrypt sensitive request/response data
      const encryptedRequest = encrypt(JSON.stringify(request))
      const encryptedResponse = encrypt(JSON.stringify(response.rawResponse || response))

      const { data, error } = await supabase
        .from('creditsafe_verifications')
        .insert({
          reference_id: referenceId,
          verification_request_encrypted: encryptedRequest,
          verification_response_encrypted: encryptedResponse,
          verification_status: response.status,
          verification_score: response.riskScore || 0,

          // Store individual flags as booleans
          // Note: In Creditsafe, true = match found (which can be bad)
          // We invert for storage where true = passed check
          name_match_score: response.verifyMatch ? 100 : 0,
          address_match_score: response.electoralRegisterMatch ? 100 : 0,
          dob_match_score: response.verifyMatch ? 100 : 0,

          // Compliance checks (true = problem found)
          pep_check_result: false, // Not provided by Verify API
          sanctions_check_result: false, // Not provided by Verify API
          adverse_media_result: response.ccjMatch || response.insolvencyMatch || false,

          // Fraud indicators
          fraud_indicators: JSON.stringify({
            ccjMatch: response.ccjMatch,
            insolvencyMatch: response.insolvencyMatch,
            deceasedMatch: response.deceasedRegisterMatch,
            electoralRollMatch: response.electoralRegisterMatch,
            ccjCount: response.countyCourtJudgments?.length || 0,
            insolvencyCount: response.insolvencies?.length || 0
          }),
          risk_level: response.riskLevel,

          document_verified: null, // Not provided by Verify API
          document_authenticity_score: null,

          creditsafe_transaction_id: response.transactionId,
          api_response_code: '200',
          error_message: response.errorMessage,
          verified_at: response.status !== 'error' ? new Date().toISOString() : null,
          requested_by: requestedBy || null
        })
        .select('id')
        .single()

      if (error) {
        console.error('Failed to store Creditsafe verification result:', error)
        return null
      }

      return data.id
    } catch (error) {
      console.error('Error storing Creditsafe verification:', error)
      return null
    }
  }

  /**
   * Get verification result from database
   */
  async getVerificationResult(referenceId: string): Promise<any | null> {
    try {
      const { data, error } = await supabase
        .from('creditsafe_verifications')
        .select('*')
        .eq('reference_id', referenceId)
        .single()

      if (error || !data) {
        return null
      }

      // Decrypt sensitive data
      let request = null
      let response = null

      if (data.verification_request_encrypted) {
        try {
          const decrypted = decrypt(data.verification_request_encrypted)
          request = decrypted ? JSON.parse(decrypted) : null
        } catch (e) {
          console.error('Failed to decrypt verification request:', e)
        }
      }

      if (data.verification_response_encrypted) {
        try {
          const decrypted = decrypt(data.verification_response_encrypted)
          response = decrypted ? JSON.parse(decrypted) : null
        } catch (e) {
          console.error('Failed to decrypt verification response:', e)
        }
      }

      // Extract detailed arrays from raw response
      const countyCourtJudgments = response?.countyCourtJudgments || []
      const electoralRolls = response?.electoralRolls || []
      const insolvencies = response?.insolvencies || []

      // Parse fraud indicators if present
      let fraudIndicators = null
      if (data.fraud_indicators) {
        try {
          fraudIndicators = typeof data.fraud_indicators === 'string'
            ? JSON.parse(data.fraud_indicators)
            : data.fraud_indicators
        } catch (e) {
          console.error('Failed to parse fraud indicators:', e)
        }
      }

      return {
        ...data,
        verification_request: request,
        verification_response: response,
        // Add detailed arrays for frontend display
        countyCourtJudgments,
        electoralRolls,
        insolvencies,
        // Add camelCase fields for frontend compatibility
        verifyMatch: response?.verifyMatch,
        electoralRegisterMatch: fraudIndicators?.electoralRollMatch || response?.electoralRegisterMatch,
        ccjMatch: fraudIndicators?.ccjMatch || response?.ccjMatch,
        insolvencyMatch: fraudIndicators?.insolvencyMatch || response?.insolvencyMatch,
        deceasedRegisterMatch: fraudIndicators?.deceasedMatch || response?.deceasedRegisterMatch,
        riskLevel: data.risk_level,
        riskScore: data.verification_score,
        transactionId: data.creditsafe_transaction_id,
        verified_at: data.verified_at,
        // Remove encrypted fields from response
        verification_request_encrypted: undefined,
        verification_response_encrypted: undefined
      }
    } catch (error) {
      console.error('Error getting Creditsafe verification:', error)
      return null
    }
  }
}

// Export singleton instance
export const creditsafeService = new CreditsafeService()

// Export types
export type { VerificationRequest, VerificationResponse }
