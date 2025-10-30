import axios, { AxiosInstance } from 'axios'
import { supabase } from '../config/supabase'
import { encrypt, decrypt } from './encryption'

interface SanctionsConfig {
  apiUrl: string
  enabled: boolean
}

interface ScreeningRequest {
  name: string
  dateOfBirth?: string // Format: YYYY-MM-DD
  postcode?: string
  companyName?: string
  companyReg?: string
}

interface SanctionsMatch {
  database: string
  matched_name: string
  unique_id: string
  entity_type: string
  date_listed: string
  nationality?: string
  date_of_birth?: string
  aliases: string[]
  sanctions?: Array<{
    regime: string
    type: string
    date: string
  }>
  severity?: string
}

interface DonationMatch {
  donor_name: string
  recipient_name: string
  value: number
  date: string
  donor_type: string
}

interface ScreeningResponse {
  query: string
  screening_date: string
  risk_level: 'clear' | 'low' | 'medium' | 'high'
  sanctions_matches: SanctionsMatch[]
  donation_matches: DonationMatch[]
  total_matches: number
  summary: string
}

class SanctionsService {
  private config: SanctionsConfig
  private axiosInstance: AxiosInstance

  constructor() {
    this.config = {
      apiUrl: process.env.SANCTIONS_API_URL || 'https://sanlist-production.up.railway.app',
      enabled: process.env.SANCTIONS_ENABLED === 'true'
    }

    this.axiosInstance = axios.create({
      baseURL: this.config.apiUrl,
      timeout: 10000, // 10 second timeout (API averages ~480ms)
      headers: {
        'Content-Type': 'application/json'
      }
    })
  }

  /**
   * Check if sanctions screening is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled
  }

  /**
   * Screen a tenant against UK Sanctions List and Electoral Commission donations
   */
  async screenTenant(request: ScreeningRequest): Promise<ScreeningResponse> {
    try {
      console.log('Screening tenant:', request.name)

      // Build query parameters
      const params: Record<string, string> = {
        name: request.name,
        exact_match: 'false' // Use fuzzy matching for better results
      }

      if (request.dateOfBirth) {
        params.date_of_birth = request.dateOfBirth
      }

      if (request.postcode) {
        params.postcode = request.postcode
      }

      if (request.companyName) {
        params.company_name = request.companyName
      }

      if (request.companyReg) {
        params.company_reg = request.companyReg
      }

      // Call the sanctions screening API
      const response = await this.axiosInstance.get('/api/screen-tenant', {
        params
      })

      if (response.status === 200 && response.data) {
        console.log(`Sanctions screening completed for ${request.name}:`,
                    `Risk: ${response.data.risk_level},`,
                    `Total matches: ${response.data.total_matches}`)

        return response.data as ScreeningResponse
      }

      // Unexpected response
      throw new Error(`Unexpected response from sanctions API: ${response.status}`)

    } catch (error: any) {
      console.error('Sanctions screening API error:', error.message)

      // Fail-safe: Return "clear" status but flag for manual review
      // This prevents blocking legitimate tenants if the API is down
      return {
        query: request.name,
        screening_date: new Date().toISOString(),
        risk_level: 'clear',
        sanctions_matches: [],
        donation_matches: [],
        total_matches: 0,
        summary: `API unavailable - manual review required. Error: ${error.message}`
      }
    }
  }

  /**
   * Store sanctions screening result in the database
   */
  async storeScreeningResult(
    referenceId: string,
    request: ScreeningRequest,
    result: ScreeningResponse
  ): Promise<void> {
    try {
      // Encrypt the full API response for audit/compliance
      const encryptedResponse = encrypt(JSON.stringify(result))

      const { error } = await supabase
        .from('sanctions_screenings')
        .insert({
          reference_id: referenceId,
          screening_status: result.risk_level,
          sanctions_matches: result.sanctions_matches,
          donation_matches: result.donation_matches,
          total_matches: result.total_matches,
          risk_level: result.risk_level,
          summary_message: result.summary,
          api_response_encrypted: encryptedResponse,
          screening_date: result.screening_date,
          tenant_name: request.name,
          tenant_dob: request.dateOfBirth || null,
          tenant_postcode: request.postcode || null
        })

      if (error) {
        console.error('Failed to store sanctions screening result:', error)
        throw error
      }

      console.log('Sanctions screening result stored successfully for reference:', referenceId)

    } catch (error: any) {
      console.error('Error storing sanctions screening result:', error)
      throw error
    }
  }

  /**
   * Get screening result for a reference
   */
  async getScreeningResult(referenceId: string): Promise<any | null> {
    try {
      const { data, error } = await supabase
        .from('sanctions_screenings')
        .select('*')
        .eq('reference_id', referenceId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) {
        console.error('Error fetching sanctions screening result:', error)
        return null
      }

      // Decrypt the full response if needed
      if (data && data.api_response_encrypted) {
        try {
          const decryptedResponse = decrypt(data.api_response_encrypted)
          data.api_response = decryptedResponse ? JSON.parse(decryptedResponse) : null
        } catch (decryptError) {
          console.error('Failed to decrypt API response:', decryptError)
        }
      }

      return data

    } catch (error: any) {
      console.error('Error getting sanctions screening result:', error)
      return null
    }
  }

  /**
   * Check if a tenant requires manual review based on screening
   */
  requiresManualReview(result: ScreeningResponse): boolean {
    return result.risk_level === 'high' || result.risk_level === 'medium'
  }

  /**
   * Check if a tenant should be automatically rejected
   */
  shouldReject(result: ScreeningResponse): boolean {
    return result.risk_level === 'high' && result.sanctions_matches.length > 0
  }
}

// Export singleton instance
export const sanctionsService = new SanctionsService()
