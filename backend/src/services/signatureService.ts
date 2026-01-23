import crypto from 'crypto'
import { supabase } from '../config/supabase'
import { sendEmail, loadEmailTemplate } from './emailService'
import { pdfGenerationService, AgreementPDFData, SignatureData } from './pdfGenerationService'

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://app.propertygoose.co.uk'
const TOKEN_EXPIRY_DAYS = 7

export interface SignatureRecord {
  id: string
  agreement_id: string
  signer_type: 'landlord' | 'tenant' | 'guarantor'
  signer_index: number
  signer_name: string
  signer_email: string
  signature_data: string | null
  signature_type: 'draw' | 'type' | null
  typed_name: string | null
  status: 'pending' | 'sent' | 'viewed' | 'signed' | 'declined'
  decline_reason: string | null
  signing_token: string
  token_expires_at: string
  token_used_at: string | null
  ip_address: string | null
  user_agent: string | null
  geolocation: any | null
  email_verified_at: string | null
  signed_at: string | null
  last_email_sent_at: string | null
  email_send_count: number
  created_at: string
  updated_at: string
  agreements?: any
}

export interface ClientInfo {
  ip: string
  userAgent: string
  geolocation?: {
    latitude?: number
    longitude?: number
    accuracy?: number
    city?: string
    country?: string
  }
}

export interface SigningStatus {
  id: string
  signer_name: string
  signer_email: string
  signer_type: 'landlord' | 'tenant' | 'guarantor'
  status: 'pending' | 'sent' | 'viewed' | 'signed' | 'declined'
  signedAt: string | null
}

class SignatureService {
  /**
   * Generate a cryptographically secure signing token
   */
  private generateSigningToken(): string {
    return crypto.randomBytes(32).toString('base64url')
  }

  /**
   * Calculate token expiry date
   */
  private getTokenExpiry(): Date {
    const expiry = new Date()
    expiry.setDate(expiry.getDate() + TOKEN_EXPIRY_DAYS)
    return expiry
  }

  /**
   * Get agreement data from database
   */
  async getAgreement(agreementId: string): Promise<any> {
    const { data, error } = await supabase
      .from('agreements')
      .select('*')
      .eq('id', agreementId)
      .single()

    if (error) {
      throw new Error(`Failed to fetch agreement: ${error.message}`)
    }

    return data
  }

  /**
   * Create a signature record for a single signer
   */
  private async createSignatureRecord(
    agreementId: string,
    signerType: 'landlord' | 'tenant' | 'guarantor',
    signerIndex: number,
    party: { name: string; email?: string; address?: any }
  ): Promise<SignatureRecord> {
    const token = this.generateSigningToken()
    const tokenExpiry = this.getTokenExpiry()

    // Get email from party data or agreement
    let signerEmail = party.email || ''

    // If no email on party, try to get from agreement based on type
    if (!signerEmail) {
      const agreement = await this.getAgreement(agreementId)
      if (signerType === 'tenant' && signerIndex === 0) {
        signerEmail = agreement.tenant_email || ''
      } else if (signerType === 'landlord') {
        // For managed properties, ALL landlords use agent email
        if (agreement.management_type === 'managed') {
          signerEmail = agreement.agent_email || ''
        } else if (signerIndex === 0) {
          signerEmail = agreement.landlord_email || ''
        }
      }
    }

    const { data, error } = await supabase
      .from('agreement_signatures')
      .insert({
        agreement_id: agreementId,
        signer_type: signerType,
        signer_index: signerIndex,
        signer_name: party.name,
        signer_email: signerEmail,
        signing_token: token,
        token_expires_at: tokenExpiry.toISOString(),
        status: 'pending'
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create signature record: ${error.message}`)
    }

    // Log the creation event
    await this.logEvent(data.id, agreementId, 'created', {})

    return data
  }

  /**
   * Log an audit event
   */
  async logEvent(
    signatureId: string,
    agreementId: string,
    eventType: string,
    clientInfo: Partial<ClientInfo>,
    metadata: any = {}
  ): Promise<void> {
    await supabase
      .from('agreement_signature_events')
      .insert({
        signature_id: signatureId,
        agreement_id: agreementId,
        event_type: eventType,
        ip_address: clientInfo.ip || null,
        user_agent: clientInfo.userAgent || null,
        geolocation: clientInfo.geolocation || null,
        metadata
      })
  }

  /**
   * Initialize signing workflow - creates signature records for all parties
   */
  async initiateSigning(agreementId: string): Promise<void> {
    const agreement = await this.getAgreement(agreementId)

    // Check if signing already initiated
    if (agreement.signing_status !== 'draft') {
      throw new Error('Signing has already been initiated for this agreement')
    }

    const signaturePromises: Promise<SignatureRecord>[] = []

    // Create records for landlords
    // For managed properties, ALL landlords get signature records but use agent email
    // For non-managed properties, each landlord uses their own email
    const isManagedProperty = agreement.management_type === 'managed'
    let agentEmail = ''

    if (isManagedProperty) {
      // Get agent email for managed properties
      if (agreement.agent_email) {
        agentEmail = agreement.agent_email
      } else {
        // Fallback: get from user who created agreement
        const { data: userData, error: userError } = await supabase.auth.admin.getUserById(
          agreement.created_by_user_id
        )
        if (!userError && userData?.user?.email) {
          agentEmail = userData.user.email
        }
      }
    }

    // Create signature records for ALL landlords
    for (let i = 0; i < agreement.landlords.length; i++) {
      const landlord = agreement.landlords[i]
      signaturePromises.push(
        this.createSignatureRecord(agreementId, 'landlord', i, {
          name: landlord.name,
          // For managed properties, use agent email for ALL landlords
          // For non-managed, use landlord's individual email
          email: isManagedProperty
            ? agentEmail
            : (landlord.email || (i === 0 ? agreement.landlord_email : undefined)),
          address: landlord.address
        })
      )
    }

    // Create records for tenants
    for (let i = 0; i < agreement.tenants.length; i++) {
      const tenant = agreement.tenants[i]
      signaturePromises.push(
        this.createSignatureRecord(agreementId, 'tenant', i, {
          name: tenant.name,
          // Use tenant's individual email, fallback to agreement.tenant_email for first tenant
          email: tenant.email || (i === 0 ? agreement.tenant_email : undefined),
          address: tenant.address
        })
      )
    }

    // Create records for guarantors
    const guarantors = agreement.guarantors || []
    for (let i = 0; i < guarantors.length; i++) {
      const guarantor = guarantors[i]
      signaturePromises.push(
        this.createSignatureRecord(agreementId, 'guarantor', i, {
          name: guarantor.name,
          email: guarantor.email,
          address: guarantor.address
        })
      )
    }

    await Promise.all(signaturePromises)

    // Update agreement status
    const tokenExpiry = this.getTokenExpiry()
    await supabase
      .from('agreements')
      .update({
        signing_status: 'pending_signatures',
        signing_initiated_at: new Date().toISOString(),
        signing_expires_at: tokenExpiry.toISOString()
      })
      .eq('id', agreementId)

    // Send all signing emails simultaneously (parallel signing)
    await this.sendAllSigningEmails(agreementId)
  }

  /**
   * Send signing request emails to all pending signers
   */
  async sendAllSigningEmails(agreementId: string): Promise<void> {
    const { data: signatures } = await supabase
      .from('agreement_signatures')
      .select('*')
      .eq('agreement_id', agreementId)
      .in('status', ['pending', 'sent'])

    if (!signatures) return

    const agreement = await this.getAgreement(agreementId)
    const propertyAddress = this.formatAddress(agreement.property_address)

    // Fetch company logo for the agreement
    let companyLogoUrl: string | undefined
    if (agreement.company_id) {
      const { data: companyData } = await supabase
        .from('companies')
        .select('logo_url')
        .eq('id', agreement.company_id)
        .single()

      if (companyData) {
        companyLogoUrl = companyData.logo_url || undefined
      }
    }

    const emailPromises = signatures.map(async (sig: SignatureRecord) => {
      if (!sig.signer_email) {
        console.warn(`No email for signer ${sig.signer_name}, skipping`)
        return
      }

      await this.sendSigningEmail(sig, propertyAddress, companyLogoUrl)
    })

    await Promise.all(emailPromises)
  }

  /**
   * Send signing request email to a single signer
   */
  private async sendSigningEmail(signature: SignatureRecord, propertyAddress: string, companyLogoUrl?: string): Promise<void> {
    const signingUrl = `${FRONTEND_URL}/sign/${signature.signing_token}`
    const DEFAULT_LOGO_URL = 'https://app.propertygoose.co.uk/PropertyGooseLogo.png'

    try {
      const html = loadEmailTemplate('agreement-signing-request', {
        SignerName: signature.signer_name,
        SignerType: this.capitalizeFirst(signature.signer_type),
        PropertyAddress: propertyAddress,
        SigningUrl: signingUrl,
        AgentLogoUrl: companyLogoUrl || DEFAULT_LOGO_URL,
      })

      await sendEmail({
        to: signature.signer_email,
        subject: `Action Required: Sign Your Tenancy Agreement for ${propertyAddress}`,
        html
      })

      // Update signature record
      await supabase
        .from('agreement_signatures')
        .update({
          status: 'sent',
          last_email_sent_at: new Date().toISOString(),
          email_send_count: signature.email_send_count + 1
        })
        .eq('id', signature.id)

      // Log event
      await this.logEvent(signature.id, signature.agreement_id, 'email_sent', {})
    } catch (error) {
      console.error(`Failed to send signing email to ${signature.signer_email}:`, error)
    }
  }

  /**
   * Send reminder email to a signer
   */
  async sendReminderEmail(signatureId: string): Promise<void> {
    const { data: signature } = await supabase
      .from('agreement_signatures')
      .select('*, agreements(*)')
      .eq('id', signatureId)
      .single()

    if (!signature || !signature.signer_email) {
      throw new Error('Signature record not found or no email')
    }

    if (signature.status === 'signed') {
      throw new Error('Signer has already signed')
    }

    const agreement = signature.agreements
    const propertyAddress = this.formatAddress(agreement.property_address)
    const signingUrl = `${FRONTEND_URL}/sign/${signature.signing_token}`
    const DEFAULT_LOGO_URL = 'https://app.propertygoose.co.uk/PropertyGooseLogo.png'

    // Fetch company logo for the agreement
    let companyLogoUrl: string | undefined
    if (agreement.company_id) {
      const { data: companyData } = await supabase
        .from('companies')
        .select('logo_url')
        .eq('id', agreement.company_id)
        .single()

      if (companyData) {
        companyLogoUrl = companyData.logo_url || undefined
      }
    }

    const html = loadEmailTemplate('agreement-signing-reminder', {
      SignerName: signature.signer_name,
      SignerType: this.capitalizeFirst(signature.signer_type),
      PropertyAddress: propertyAddress,
      SigningUrl: signingUrl,
      AgentLogoUrl: companyLogoUrl || DEFAULT_LOGO_URL,
    })

    await sendEmail({
      to: signature.signer_email,
      subject: `Reminder: Your Tenancy Agreement Awaits Signature - ${propertyAddress}`,
      html
    })

    // Update signature record
    await supabase
      .from('agreement_signatures')
      .update({
        last_email_sent_at: new Date().toISOString(),
        email_send_count: signature.email_send_count + 1
      })
      .eq('id', signatureId)

    // Log event
    await this.logEvent(signatureId, signature.agreement_id, 'reminder_sent', {})
  }

  /**
   * Verify a signing token and return the signature record
   */
  async verifySigningToken(token: string): Promise<SignatureRecord | null> {
    const { data, error } = await supabase
      .from('agreement_signatures')
      .select('*, agreements(*)')
      .eq('signing_token', token)
      .single()

    if (error || !data) {
      // Log diagnostic info when token is not found
      console.error('[SignatureService] Token not found in database:', {
        token: token.substring(0, 10) + '...', // Log partial token for privacy
        error: error?.message,
        timestamp: new Date().toISOString()
      })
      return null
    }

    // EXPIRY CHECK DISABLED - Signing links now work indefinitely (matching reference links behavior)
    // The token_expires_at column is kept for audit purposes only
    // This matches the UX improvement made to reference links in commit 854712a

    // Log token details for diagnostics
    const expiresAt = new Date(data.token_expires_at)
    const now = new Date()
    console.log('[SignatureService] Token validation details:', {
      signatureId: data.id,
      agreementId: data.agreement_id,
      status: data.status,
      tokenExpiresAt: expiresAt.toISOString(),
      currentTime: now.toISOString(),
      expiresAtTimestamp: expiresAt.getTime(),
      nowTimestamp: now.getTime(),
      isExpired: expiresAt.getTime() < now.getTime(),
      daysSinceCreation: Math.floor((now.getTime() - new Date(data.created_at).getTime()) / (1000 * 60 * 60 * 24))
    })

    // Check if token has expired - COMMENTED OUT (expiry no longer enforced)
    // if (expiresAt.getTime() < now.getTime()) {
    //   await this.logEvent(data.id, data.agreement_id, 'token_expired', {})
    //   console.warn('[SignatureService] Token expired:', {
    //     signatureId: data.id,
    //     expiresAt: expiresAt.toISOString(),
    //     currentTime: now.toISOString()
    //   })
    //   return null
    // }

    // Check if already used/signed
    if (data.status === 'signed') {
      return data // Return data but flag it's already signed
    }

    return data
  }

  /**
   * Record that the document was viewed
   */
  async recordDocumentView(token: string, clientInfo: ClientInfo): Promise<void> {
    const signature = await this.verifySigningToken(token)
    if (!signature) return

    if (signature.status === 'sent') {
      await supabase
        .from('agreement_signatures')
        .update({ status: 'viewed' })
        .eq('id', signature.id)
    }

    await this.logEvent(signature.id, signature.agreement_id, 'document_viewed', clientInfo)
  }

  /**
   * Submit a signature
   */
  async submitSignature(
    token: string,
    signatureData: string,
    signatureType: 'draw' | 'type',
    typedName: string | null,
    clientInfo: ClientInfo
  ): Promise<{ success: boolean; allSigned: boolean }> {
    const signature = await this.verifySigningToken(token)

    if (!signature) {
      throw new Error('Invalid or expired signing token')
    }

    if (signature.status === 'signed') {
      throw new Error('This document has already been signed')
    }

    // Update signature record with all audit data
    const { error } = await supabase
      .from('agreement_signatures')
      .update({
        signature_data: signatureData,
        signature_type: signatureType,
        typed_name: typedName,
        status: 'signed',
        signed_at: new Date().toISOString(),
        ip_address: clientInfo.ip,
        user_agent: clientInfo.userAgent,
        geolocation: clientInfo.geolocation,
        token_used_at: new Date().toISOString(),
        email_verified_at: new Date().toISOString() // They clicked the email link
      })
      .eq('id', signature.id)

    if (error) {
      throw new Error(`Failed to save signature: ${error.message}`)
    }

    // Log audit event
    await this.logEvent(signature.id, signature.agreement_id, 'signature_completed', clientInfo, {
      signatureType
    })

    // Check if all parties have signed
    const allSigned = await this.checkAllSigned(signature.agreement_id)

    if (allSigned) {
      await this.finalizeAgreement(signature.agreement_id)
    } else {
      await this.updateSigningStatus(signature.agreement_id)
    }

    return { success: true, allSigned }
  }

  /**
   * Decline to sign
   */
  async declineSignature(token: string, reason: string, clientInfo: ClientInfo): Promise<void> {
    const signature = await this.verifySigningToken(token)

    if (!signature) {
      throw new Error('Invalid or expired signing token')
    }

    await supabase
      .from('agreement_signatures')
      .update({
        status: 'declined',
        decline_reason: reason,
        ip_address: clientInfo.ip,
        user_agent: clientInfo.userAgent
      })
      .eq('id', signature.id)

    await this.logEvent(signature.id, signature.agreement_id, 'signature_declined', clientInfo, {
      reason
    })

    // Update agreement status
    await supabase
      .from('agreements')
      .update({ signing_status: 'cancelled' })
      .eq('id', signature.agreement_id)
  }

  /**
   * Check if all parties have signed
   */
  async checkAllSigned(agreementId: string): Promise<boolean> {
    const { data: signatures } = await supabase
      .from('agreement_signatures')
      .select('status')
      .eq('agreement_id', agreementId)

    if (!signatures || signatures.length === 0) {
      return false
    }

    return signatures.every((s: { status: string }) => s.status === 'signed')
  }

  /**
   * Update agreement signing status based on current signatures
   */
  private async updateSigningStatus(agreementId: string): Promise<void> {
    const { data: signatures } = await supabase
      .from('agreement_signatures')
      .select('status')
      .eq('agreement_id', agreementId)

    if (!signatures) return

    const signedCount = signatures.filter((s: { status: string }) => s.status === 'signed').length
    const totalCount = signatures.length

    let newStatus = 'pending_signatures'
    if (signedCount > 0 && signedCount < totalCount) {
      newStatus = 'partially_signed'
    } else if (signedCount === totalCount) {
      newStatus = 'fully_signed'
    }

    await supabase
      .from('agreements')
      .update({ signing_status: newStatus })
      .eq('id', agreementId)
  }

  /**
   * Finalize agreement - generate signed PDF and send to all parties
   */
  async finalizeAgreement(agreementId: string): Promise<void> {
    console.log(`Finalizing agreement ${agreementId}`)

    // Fetch all signatures
    const { data: signatures } = await supabase
      .from('agreement_signatures')
      .select('*')
      .eq('agreement_id', agreementId)
      .eq('status', 'signed')

    if (!signatures || signatures.length === 0) {
      throw new Error('No signed signatures found')
    }

    // Get agreement data
    const agreement = await this.getAgreement(agreementId)

    // Convert signatures to SignatureData format
    const signatureDataList: SignatureData[] = signatures.map((sig: SignatureRecord) => ({
      signerType: sig.signer_type,
      signerIndex: sig.signer_index,
      signerName: sig.signer_name,
      signatureImage: sig.signature_data || '',
      signatureType: sig.signature_type || 'draw',
      typedName: sig.typed_name || '',
      signedAt: sig.signed_at || new Date().toISOString(),
      ipAddress: sig.ip_address || 'Unknown'
    }))

    // Fetch company logo for the agreement
    let companyLogoUrl: string | undefined
    if (agreement.company_id) {
      const { data: companyData } = await supabase
        .from('companies')
        .select('logo_url')
        .eq('id', agreement.company_id)
        .single()

      if (companyData) {
        companyLogoUrl = companyData.logo_url || undefined
      }
    }

    // Build AgreementPDFData
    const pdfData: AgreementPDFData = {
      templateType: agreement.template_type,
      language: agreement.language || 'english',
      propertyAddress: agreement.property_address,
      landlords: agreement.landlords,
      tenants: agreement.tenants,
      guarantors: agreement.guarantors || [],
      depositAmount: agreement.deposit_amount,
      rentAmount: agreement.rent_amount,
      tenancyStartDate: agreement.tenancy_start_date,
      tenancyEndDate: agreement.tenancy_end_date,
      rentDueDay: agreement.rent_due_day,
      depositSchemeType: agreement.deposit_scheme_type,
      permittedOccupiers: agreement.permitted_occupiers,
      bankAccountName: agreement.bank_account_name,
      bankAccountNumber: agreement.bank_account_number,
      bankSortCode: agreement.bank_sort_code,
      tenantEmail: agreement.tenant_email,
      landlordEmail: agreement.landlord_email,
      agentEmail: agreement.agent_email,
      managementType: agreement.management_type,
      breakClause: agreement.break_clause,
      specialClauses: agreement.special_clauses,
      companyLogoUrl
    }

    // Generate final signed PDF with audit page
    const signedPdf = await pdfGenerationService.generateSignedPDF(
      pdfData,
      signatureDataList,
      agreementId
    )

    // Upload to Supabase Storage
    const fileName = `signed_agreement_${agreementId}_${Date.now()}.pdf`
    const filePath = `agreements/${agreementId}/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, signedPdf, {
        contentType: 'application/pdf',
        upsert: true
      })

    if (uploadError) {
      throw new Error(`Failed to upload signed PDF: ${uploadError.message}`)
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('documents')
      .getPublicUrl(filePath)

    // Update agreement record
    await supabase
      .from('agreements')
      .update({
        signing_status: 'fully_signed',
        signed_pdf_url: urlData.publicUrl,
        signed_pdf_generated_at: new Date().toISOString(),
        signing_completed_at: new Date().toISOString()
      })
      .eq('id', agreementId)

    // Send completion emails to all parties
    await this.sendCompletionEmails(agreementId, signedPdf)
  }

  /**
   * Send completion emails with signed PDF to all parties
   */
  private async sendCompletionEmails(agreementId: string, pdfBuffer: Buffer): Promise<void> {
    const { data: signatures } = await supabase
      .from('agreement_signatures')
      .select('*')
      .eq('agreement_id', agreementId)

    if (!signatures) return

    const agreement = await this.getAgreement(agreementId)
    const propertyAddress = this.formatAddress(agreement.property_address)

    // Build list of all signers for the email
    const signerList = signatures.map((sig: SignatureRecord) =>
      `${sig.signer_name} (${this.capitalizeFirst(sig.signer_type)}) - Signed ${new Date(sig.signed_at || new Date()).toLocaleDateString('en-GB')}`
    ).join('\n')

    let uniqueEmails = [...new Set(signatures.map((s: SignatureRecord) => s.signer_email).filter(Boolean))] as string[]

    // For managed properties, ALWAYS include the agent's email in recipients
    if (agreement.management_type === 'managed' && agreement.created_by_user_id) {
      const { data: userData, error: userError } = await supabase.auth.admin.getUserById(
        agreement.created_by_user_id
      )

      if (!userError && userData?.user?.email) {
        const agentEmail = userData.user.email
        // Add agent email if not already in the list
        if (!uniqueEmails.includes(agentEmail)) {
          uniqueEmails.push(agentEmail)
        }
      }
    }

    for (const email of uniqueEmails) {
      const signer = signatures.find((s: SignatureRecord) => s.signer_email === email)

      // Determine recipient name (could be a signer or the agent receiving a copy)
      let recipientName = 'PropertyGoose User'
      if (signer) {
        recipientName = signer.signer_name
      } else if (agreement.management_type === 'managed' && agreement.created_by_user_id) {
        // This might be the agent receiving a copy (not a signer)
        const { data: userData } = await supabase.auth.admin.getUserById(
          agreement.created_by_user_id
        )
        if (userData?.user) {
          recipientName = userData.user.user_metadata?.full_name || 'Agent'
        }
      }

      try {
        const html = loadEmailTemplate('agreement-fully-signed', {
          SignerName: recipientName,
          PropertyAddress: propertyAddress,
          SignerList: signerList.replace(/\n/g, '<br>'),
          CompletionDate: new Date().toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          })
        })

        await sendEmail({
          to: email,
          subject: `Your Tenancy Agreement is Complete - ${propertyAddress}`,
          html,
          attachments: [
            {
              filename: `Tenancy_Agreement_${propertyAddress.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
              content: pdfBuffer
            }
          ]
        })
      } catch (error) {
        console.error(`Failed to send completion email to ${email}:`, error)
      }
    }
  }

  /**
   * Get signing status for all parties of an agreement
   */
  async getSigningStatus(agreementId: string): Promise<SigningStatus[]> {
    const { data: signatures } = await supabase
      .from('agreement_signatures')
      .select('id, signer_name, signer_email, signer_type, status, signed_at')
      .eq('agreement_id', agreementId)
      .order('signer_type')
      .order('signer_index')

    if (!signatures) return []

    return signatures.map((sig: { id: string; signer_name: string; signer_email: string | null; signer_type: 'landlord' | 'tenant' | 'guarantor'; status: string; signed_at: string | null }) => ({
      id: sig.id,
      signer_name: sig.signer_name,
      signer_email: sig.signer_email || '',
      signer_type: sig.signer_type,
      status: sig.status as 'pending' | 'sent' | 'viewed' | 'signed' | 'declined',
      signedAt: sig.signed_at
    }))
  }

  /**
   * Cancel signing and expire all tokens
   */
  async cancelSigning(agreementId: string): Promise<void> {
    await supabase
      .from('agreement_signatures')
      .update({
        token_expires_at: new Date().toISOString()
      })
      .eq('agreement_id', agreementId)
      .neq('status', 'signed')

    await supabase
      .from('agreements')
      .update({ signing_status: 'cancelled' })
      .eq('id', agreementId)
  }

  /**
   * Regenerate token for a signer (e.g., if expired)
   */
  async regenerateToken(signatureId: string): Promise<string> {
    const newToken = this.generateSigningToken()
    const newExpiry = this.getTokenExpiry()

    const { data, error } = await supabase
      .from('agreement_signatures')
      .update({
        signing_token: newToken,
        token_expires_at: newExpiry.toISOString(),
        token_used_at: null
      })
      .eq('id', signatureId)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to regenerate token: ${error.message}`)
    }

    await this.logEvent(signatureId, data.agreement_id, 'token_regenerated', {})

    return newToken
  }

  /**
   * Helper: Format address
   */
  private formatAddress(address: any): string {
    if (!address) return ''
    const parts = [
      address.line1,
      address.line2,
      address.city,
      address.county,
      address.postcode
    ].filter(Boolean)
    return parts.join(', ')
  }

  /**
   * Helper: Capitalize first letter
   */
  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1)
  }
}

export const signatureService = new SignatureService()
