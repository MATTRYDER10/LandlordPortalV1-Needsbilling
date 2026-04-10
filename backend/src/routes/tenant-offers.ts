import { Router } from 'express'
import { authenticateToken, requireMember, AuthRequest, getCompanyIdForRequest } from '../middleware/auth'
import { supabase } from '../config/supabase'
import { encrypt, decrypt, generateToken, hash } from '../services/encryption'
import { sendEmail, sendTenantReferenceRequest, sendTenantOfferRequest, sendOfferAcceptedEmail, sendOfferDeclinedEmail, sendPaymentConfirmedToAgentEmail, sendTenantOfferConfirmation } from '../services/emailService'
import { checkCredits } from '../middleware/checkCredits'
import { checkPaymentMethod } from '../middleware/checkPaymentMethod'
import * as billingService from '../services/billingService'
import { auditReferenceAction } from '../services/auditLog'
import { logOfferAuditAction } from '../services/offerAuditService'
import { auditOfferSent, auditOfferCompleted, auditOfferAccepted, auditOfferRejected } from '../services/propertyAuditService'
import { BRAND_COLORS } from '../config/colors'
import { getFrontendUrl } from '../utils/frontendUrl'

const router = Router()
const frontendUrl = getFrontendUrl()

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const sendTenantReferenceWithRetry = async (params: {
    tenantEmail: string
    tenantName: string
    tenantUrl: string
    companyName: string
    propertyAddress?: string
    companyPhone?: string
    companyEmail?: string
    referenceId?: string
    companyLogoUrl?: string | null
}): Promise<void> => {
    const email = params.tenantEmail.trim()
    if (!email) {
        throw new Error('Missing tenant email')
    }

    const attempts = 3
    let lastError: any
    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            await sendTenantReferenceRequest(
                email,
                params.tenantName,
                params.tenantUrl,
                params.companyName,
                params.propertyAddress,
                params.companyPhone,
                params.companyEmail,
                params.referenceId,
                params.companyLogoUrl
            )
            return
        } catch (error) {
            lastError = error
            if (attempt < attempts) {
                await delay(500 * attempt)
            }
        }
    }
    throw lastError
}

// Send offer form link via email
router.post('/send-link', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const userId = req.user?.id
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' })
        }

        const {
            tenant_email,
            property_address,
            property_city,
            property_postcode,
            rent_amount,
            offer_deposit_replacement,
            bills_included,
            linked_property_id
        } = req.body

        // Validate required fields
        if (!tenant_email || !property_address) {
            return res.status(400).json({ error: 'Tenant email and property address are required' })
        }

        // Get company from X-Branch-Id header or user's company
        const companyId = await getCompanyIdForRequest(req)
        if (!companyId) {
            return res.status(404).json({ error: 'Company not found' })
        }

        // Get company details for email branding
        const { data: company } = await supabase
            .from('companies')
            .select('name_encrypted, phone_encrypted, email_encrypted, logo_url')
            .eq('id', companyId)
            .single()

        const companyName = company?.name_encrypted
            ? (decrypt(company.name_encrypted) || 'PropertyGoose')
            : 'PropertyGoose'
        const companyPhone = company?.phone_encrypted
            ? (decrypt(company.phone_encrypted) || '')
            : ''
        const companyEmail = company?.email_encrypted
            ? (decrypt(company.email_encrypted) || '')
            : ''
        const companyLogoUrl = company?.logo_url || null

        // Generate unique form reference
        const formRef = 'OF-' + Math.random().toString(36).substring(2, 10).toUpperCase()

        // Generate offer form link with company ID, form_ref, and pre-filled data
        const depositReplacementQuery = offer_deposit_replacement ? '&deposit_replacement_offered=1' : ''
        const billsIncludedQuery = bills_included ? '&bills_included=1' : ''
        const propertyAddressQuery = property_address ? `&property_address=${encodeURIComponent(property_address)}` : ''
        const propertyCityQuery = property_city ? `&property_city=${encodeURIComponent(property_city)}` : ''
        const propertyPostcodeQuery = property_postcode ? `&property_postcode=${encodeURIComponent(property_postcode)}` : ''
        const rentAmountQuery = rent_amount ? `&rent_amount=${encodeURIComponent(rent_amount)}` : ''
        const offerLink = `${frontendUrl}/tenant-offer?company_id=${companyId}&form_ref=${formRef}${depositReplacementQuery}${billsIncludedQuery}${propertyAddressQuery}${propertyCityQuery}${propertyPostcodeQuery}${rentAmountQuery}`

        // Store record of sent offer form for tracking (do this first to ensure form_ref exists)
        try {
            await supabase
                .from('sent_offer_forms')
                .insert({
                    company_id: companyId,
                    sent_by: userId,
                    tenant_email: tenant_email,
                    property_address_encrypted: encrypt(property_address),
                    property_city_encrypted: property_city ? encrypt(property_city) : null,
                    property_postcode_encrypted: property_postcode ? encrypt(property_postcode) : null,
                    rent_amount: rent_amount || null,
                    offer_deposit_replacement: !!offer_deposit_replacement,
                    linked_property_id: linked_property_id || null,
                    form_ref: formRef,
                    is_v2: true
                })
        } catch (dbError: any) {
            console.error('Failed to store sent offer form record:', dbError)
            // Don't fail the request if DB insert fails
        }

        // Send email to tenant with offer form link
        try {
            await sendTenantOfferRequest(
                tenant_email,
                offerLink,
                companyName,
                property_address,
                companyPhone || undefined,
                companyEmail || undefined,
                companyLogoUrl
            )
            console.log('Offer form email sent successfully to:', tenant_email)
        } catch (emailError: any) {
            console.error('Failed to send offer form email:', emailError)
            // Don't fail the request if email fails, just log it
        }

        // Log property audit if property is linked
        if (linked_property_id) {
            try {
                await auditOfferSent(
                    linked_property_id,
                    companyId,
                    userId,
                    tenant_email
                )
            } catch (auditError: any) {
                console.error('Failed to log property audit:', auditError)
                // Don't fail - audit logging is non-critical
            }
        }

        res.status(200).json({
            success: true,
            message: 'Offer form link sent successfully',
            email: tenant_email,
            deposit_replacement_offered: !!offer_deposit_replacement
        })
    } catch (error: any) {
        console.error('Error sending offer form link:', error)
        res.status(500).json({ error: error.message })
    }
})

// Get all offers for company
router.get('/', authenticateToken, requireMember, async (req: AuthRequest, res) => {
    try {
        const companyId = req.companyId!

        // Get all offers for the company with tenants
        const { data: offers, error } = await supabase
            .from('tenant_offers')
            .select(`
        *,
        tenant_offer_tenants (
          id,
          tenant_order,
          name_encrypted,
          first_name_encrypted,
          last_name_encrypted,
          address_encrypted,
          phone_encrypted,
          email_encrypted,
          annual_income_encrypted,
          no_ccj_bankruptcy_iva,
          signature_encrypted,
          signature_name_encrypted,
          signed_at,
          rent_share,
          rent_share_percentage
        )
      `)
            .eq('company_id', companyId)
            .order('created_at', { ascending: false })

        if (error) {
            return res.status(400).json({ error: error.message })
        }

        // Decrypt offer data
        const decryptedOffers = offers?.map(offer => {
            const tenants = (offer.tenant_offer_tenants || []).map((tenant: any) => ({
                id: tenant.id,
                tenant_order: tenant.tenant_order,
                name: tenant.name_encrypted ? decrypt(tenant.name_encrypted) : '',
                first_name: tenant.first_name_encrypted ? decrypt(tenant.first_name_encrypted) : '',
                last_name: tenant.last_name_encrypted ? decrypt(tenant.last_name_encrypted) : '',
                address: tenant.address_encrypted ? decrypt(tenant.address_encrypted) : '',
                address_line2: tenant.address_line2_encrypted ? decrypt(tenant.address_line2_encrypted) : '',
                address_city: tenant.address_city_encrypted ? decrypt(tenant.address_city_encrypted) : '',
                address_county: tenant.address_county_encrypted ? decrypt(tenant.address_county_encrypted) : '',
                address_postcode: tenant.address_postcode_encrypted ? decrypt(tenant.address_postcode_encrypted) : '',
                address_country: tenant.address_country_encrypted ? decrypt(tenant.address_country_encrypted) : '',
                phone: tenant.phone_encrypted ? decrypt(tenant.phone_encrypted) : '',
                email: tenant.email_encrypted ? decrypt(tenant.email_encrypted) : '',
                annual_income: tenant.annual_income_encrypted ? decrypt(tenant.annual_income_encrypted) : '',
                job_title: tenant.job_title_encrypted ? decrypt(tenant.job_title_encrypted) : '',
                no_ccj_bankruptcy_iva: tenant.no_ccj_bankruptcy_iva,
                signature: tenant.signature_encrypted ? decrypt(tenant.signature_encrypted) : '',
                signature_name: tenant.signature_name_encrypted ? decrypt(tenant.signature_name_encrypted) : '',
                signed_at: tenant.signed_at,
                rent_share: tenant.rent_share,
                rent_share_percentage: tenant.rent_share_percentage
            }))

            return {
                ...offer,
                property_address: offer.property_address_encrypted ? decrypt(offer.property_address_encrypted) : '',
                property_city: offer.property_city_encrypted ? decrypt(offer.property_city_encrypted) : '',
                property_postcode: offer.property_postcode_encrypted ? decrypt(offer.property_postcode_encrypted) : '',
                special_conditions: offer.special_conditions_encrypted ? decrypt(offer.special_conditions_encrypted) : '',
                declined_reason: offer.declined_reason_encrypted ? decrypt(offer.declined_reason_encrypted) : '',
                tenants: tenants.sort((a: any, b: any) => a.tenant_order - b.tenant_order)
            }
        }) || []

        res.json({ offers: decryptedOffers })
    } catch (error: any) {
        console.error('Error fetching offers:', error)
        res.status(500).json({ error: error.message })
    }
})

// Get sent offer forms (forms sent but not yet submitted by tenants)
router.get('/sent', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const userId = req.user?.id
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' })
        }

        // Get company from X-Branch-Id header or user's company
        const companyId = await getCompanyIdForRequest(req)
        if (!companyId) {
            return res.status(404).json({ error: 'Company not found' })
        }

        // Get all sent offer forms that haven't been submitted yet
        const { data: sentForms, error } = await supabase
            .from('sent_offer_forms')
            .select('*')
            .eq('company_id', companyId)
            .eq('status', 'sent')
            .order('sent_at', { ascending: false })

        if (error) {
            return res.status(400).json({ error: error.message })
        }

        // Decrypt sent form data
        const decryptedSentForms = sentForms?.map(form => ({
            id: form.id,
            tenant_email: form.tenant_email,
            property_address: form.property_address_encrypted ? decrypt(form.property_address_encrypted) : '',
            property_city: form.property_city_encrypted ? decrypt(form.property_city_encrypted) : '',
            property_postcode: form.property_postcode_encrypted ? decrypt(form.property_postcode_encrypted) : '',
            rent_amount: form.rent_amount,
            offer_deposit_replacement: form.offer_deposit_replacement,
            sent_at: form.sent_at,
            created_at: form.created_at
        })) || []

        res.json({ sentForms: decryptedSentForms })
    } catch (error: any) {
        console.error('Error fetching sent offer forms:', error)
        res.status(500).json({ error: error.message })
    }
})

// Get offer by reference ID (for viewing linked offer from reference page)
// NOTE: This route must be defined BEFORE /:id to avoid route conflict
router.get('/by-reference/:referenceId', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const userId = req.user?.id
        const { referenceId } = req.params

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' })
        }

        // Get company ID with branch isolation support
        const companyId = await getCompanyIdForRequest(req)
        if (!companyId) {
            return res.status(404).json({ error: 'Company not found' })
        }

        // Get offer by reference_id
        const { data: offer, error } = await supabase
            .from('tenant_offers')
            .select(`
                *,
                tenant_offer_tenants (
                    id,
                    tenant_order,
                    name_encrypted,
                    first_name_encrypted,
                    last_name_encrypted,
                    address_encrypted,
                    phone_encrypted,
                    email_encrypted,
                    annual_income_encrypted,
                    job_title_encrypted,
                    no_ccj_bankruptcy_iva,
                    signature_encrypted,
                    signature_name_encrypted,
                    signed_at,
                    rent_share,
                    rent_share_percentage
                )
            `)
            .eq('reference_id', referenceId)
            .eq('company_id', companyId)
            .single()

        if (error || !offer) {
            return res.status(404).json({ error: 'No offer linked to this reference' })
        }

        // Decrypt offer data
        const tenants = (offer.tenant_offer_tenants || []).map((tenant: any) => ({
            id: tenant.id,
            tenant_order: tenant.tenant_order,
            name: tenant.name_encrypted ? decrypt(tenant.name_encrypted) : '',
            address: tenant.address_encrypted ? decrypt(tenant.address_encrypted) : '',
            address_line2: tenant.address_line2_encrypted ? decrypt(tenant.address_line2_encrypted) : '',
            address_city: tenant.address_city_encrypted ? decrypt(tenant.address_city_encrypted) : '',
            address_county: tenant.address_county_encrypted ? decrypt(tenant.address_county_encrypted) : '',
            address_postcode: tenant.address_postcode_encrypted ? decrypt(tenant.address_postcode_encrypted) : '',
            address_country: tenant.address_country_encrypted ? decrypt(tenant.address_country_encrypted) : '',
            phone: tenant.phone_encrypted ? decrypt(tenant.phone_encrypted) : '',
            email: tenant.email_encrypted ? decrypt(tenant.email_encrypted) : '',
            annual_income: tenant.annual_income_encrypted ? decrypt(tenant.annual_income_encrypted) : '',
            job_title: tenant.job_title_encrypted ? decrypt(tenant.job_title_encrypted) : '',
            no_ccj_bankruptcy_iva: tenant.no_ccj_bankruptcy_iva,
            signature: tenant.signature_encrypted ? decrypt(tenant.signature_encrypted) : '',
            signature_name: tenant.signature_name_encrypted ? decrypt(tenant.signature_name_encrypted) : '',
            signed_at: tenant.signed_at,
            rent_share: tenant.rent_share,
            rent_share_percentage: tenant.rent_share_percentage
        }))

        const decrypted = {
            ...offer,
            property_address: offer.property_address_encrypted ? decrypt(offer.property_address_encrypted) : '',
            property_city: offer.property_city_encrypted ? decrypt(offer.property_city_encrypted) : '',
            property_postcode: offer.property_postcode_encrypted ? decrypt(offer.property_postcode_encrypted) : '',
            special_conditions: offer.special_conditions_encrypted ? decrypt(offer.special_conditions_encrypted) : '',
            declined_reason: offer.declined_reason_encrypted ? decrypt(offer.declined_reason_encrypted) : '',
            tenants: tenants.sort((a: any, b: any) => a.tenant_order - b.tenant_order)
        }

        res.json({ offer: decrypted })
    } catch (error: any) {
        console.error('Error fetching offer by reference:', error)
        res.status(500).json({ error: error.message })
    }
})

// =====================================================================
// PUBLIC ROUTES (no auth required) - MUST be defined BEFORE /:id route
// =====================================================================

// Check if this specific offer form has already been submitted (public route - no auth required)
router.get('/check-submission', async (req, res) => {
    try {
        const { form_ref, email, company_id } = req.query

        // If form_ref provided, check by form_ref (preferred method)
        if (form_ref) {
            console.log('[check-submission] Checking form_ref:', form_ref)

            const { data: sentForm, error } = await supabase
                .from('sent_offer_forms')
                .select('id, status, submitted_at, tenant_offer_id')
                .eq('form_ref', form_ref as string)
                .single()

            if (error || !sentForm) {
                // Form ref not found - this is a new/unknown form
                console.log('[check-submission] form_ref not found, returning submitted: false')
                return res.status(200).json({ submitted: false })
            }

            if (sentForm.status === 'submitted' && sentForm.tenant_offer_id) {
                console.log('[check-submission] Form already submitted, offer ID:', sentForm.tenant_offer_id)
                return res.status(200).json({
                    submitted: true,
                    status: 'submitted',
                    created_at: sentForm.submitted_at
                })
            }

            console.log('[check-submission] Form not yet submitted')
            return res.status(200).json({ submitted: false })
        }

        // Legacy fallback: check by email (for old links without form_ref)
        if (!email || !company_id) {
            return res.status(200).json({ submitted: false })
        }

        console.log('[check-submission] Legacy check - email:', email, 'company:', company_id)

        // For legacy links, just return false to allow submission
        // The actual duplicate prevention happens at submit time
        return res.status(200).json({ submitted: false })
    } catch (error: any) {
        console.error('Error checking submission:', error)
        res.status(500).json({ error: error.message })
    }
})

// Submit offer form (public route - no auth required)
router.post('/submit', async (req, res) => {
    try {
        const {
            property_address,
            property_city,
            property_postcode,
            offered_rent_amount,
            proposed_move_in_date,
            proposed_tenancy_length_months,
            deposit_amount,
            special_conditions,
            bills_included,
            tenants, // Array of tenant objects
            deposit_replacement_offered,
            deposit_replacement_requested,
            unihomes_offered,
            unihomes_interested,
            linked_property_id,
            is_v2,
            form_ref // Unique reference for this offer form
        } = req.body

        // Validate required fields
        if (!property_address || !offered_rent_amount || !proposed_move_in_date || !proposed_tenancy_length_months) {
            return res.status(400).json({ error: 'Property address, rent amount, move-in date, and tenancy length are required' })
        }

        if (!tenants || !Array.isArray(tenants) || tenants.length === 0) {
            return res.status(400).json({ error: 'At least one tenant is required' })
        }

        // Validate tenancy length (1-12 months)
        if (proposed_tenancy_length_months < 1 || proposed_tenancy_length_months > 12) {
            return res.status(400).json({ error: 'Tenancy length must be between 1 and 12 months' })
        }

        // Validate each tenant
        for (let i = 0; i < tenants.length; i++) {
            const tenant = tenants[i]
            if (!tenant.name || !tenant.address || !tenant.phone || !tenant.email) {
                return res.status(400).json({ error: `Tenant ${i + 1} is missing required fields` })
            }
            if (!tenant.is_student && !tenant.annual_income) {
                return res.status(400).json({ error: `Tenant ${i + 1} must provide yearly income or be marked as a student` })
            }
            if (!tenant.no_ccj_bankruptcy_iva) {
                return res.status(400).json({ error: `Tenant ${i + 1} must confirm they have no CCJs, Bankruptcies or IVAs` })
            }
        }

        // Get company ID from query parameter or header
        // In production, this should come from a token-based system similar to tenant applications
        const companyId = (req.query.company_id as string) || (req.headers['x-company-id'] as string)

        if (!companyId) {
            return res.status(400).json({ error: 'Company ID is required. Please provide company_id as query parameter or x-company-id header.' })
        }

        // Verify company exists and get details for email
        const { data: companyData, error: companyError } = await supabase
            .from('companies')
            .select('id, name_encrypted, email_encrypted, phone_encrypted, offer_notification_email')
            .eq('id', companyId)
            .single()

        if (companyError || !companyData) {
            return res.status(404).json({ error: 'Company not found' })
        }

        const normalizeBoolean = (value: any): boolean => {
            if (Array.isArray(value)) {
                return value.some(item => normalizeBoolean(item))
            }
            if (typeof value === 'boolean') return value
            if (typeof value === 'string') {
                const normalized = value.toLowerCase()
                return normalized === 'true' || normalized === '1' || normalized === 'yes'
            }
            return false
        }

        const depositReplacementOfferedFromQuery = normalizeBoolean(req.query.deposit_replacement_offered)
        const depositReplacementOffered = normalizeBoolean(deposit_replacement_offered) || depositReplacementOfferedFromQuery
        const depositReplacementRequested = depositReplacementOffered && normalizeBoolean(deposit_replacement_requested)
        const unihomesOfferedBool = normalizeBoolean(unihomes_offered) || normalizeBoolean(req.query.unihomes)
        const unihomesInterestedBool = unihomesOfferedBool && normalizeBoolean(unihomes_interested)

        // Calculate deposit amount: £0 if deposit replacement requested, otherwise 5 weeks rent
        const rentAmount = parseFloat(offered_rent_amount)
        const calculatedDeposit = Math.floor((rentAmount * 12 / 52) * 5)
        const finalDepositAmount = depositReplacementRequested ? 0 : (deposit_amount ? parseFloat(deposit_amount) : calculatedDeposit)

        // Look up negotiator_id from sent_offer_forms
        let negotiatorId: string | null = null
        if (form_ref) {
          const { data: sentForm } = await supabase
            .from('sent_offer_forms')
            .select('negotiator_id')
            .eq('form_ref', form_ref)
            .maybeSingle()
          if (sentForm?.negotiator_id) {
            negotiatorId = sentForm.negotiator_id
          }
        }

        // Create offer
        const { data: offer, error: offerError } = await supabase
            .from('tenant_offers')
            .insert({
                company_id: companyId,
                property_address_encrypted: encrypt(property_address),
                property_city_encrypted: property_city ? encrypt(property_city) : null,
                property_postcode_encrypted: property_postcode ? encrypt(property_postcode) : null,
                offered_rent_amount: parseFloat(offered_rent_amount),
                proposed_move_in_date,
                proposed_tenancy_length_months: parseInt(proposed_tenancy_length_months),
                deposit_amount: finalDepositAmount,
                special_conditions_encrypted: special_conditions ? encrypt(special_conditions) : null,
                bills_included: bills_included === true,
                status: 'pending',
                deposit_replacement_offered: depositReplacementOffered,
                deposit_replacement_requested: depositReplacementRequested,
                unihomes_offered: unihomesOfferedBool,
                unihomes_interested: unihomesInterestedBool,
                linked_property_id: linked_property_id || null,
                is_v2: is_v2 === true,
                negotiator_id: negotiatorId
            })
            .select()
            .single()

        if (offerError || !offer) {
            return res.status(400).json({ error: offerError?.message || 'Failed to create offer' })
        }

        // Create tenant records
        const tenantRecords = tenants.map((tenant: any, index: number) => {
            const firstName = tenant.first_name || ''
            const lastName = tenant.last_name || ''
            const fullName = tenant.name || `${firstName} ${lastName}`.trim()
            return {
                tenant_offer_id: offer.id,
                tenant_order: index + 1,
                name_encrypted: encrypt(fullName),
                first_name_encrypted: firstName ? encrypt(firstName) : null,
                last_name_encrypted: lastName ? encrypt(lastName) : null,
                address_encrypted: encrypt(tenant.address),
                address_line2_encrypted: tenant.address_line2 ? encrypt(tenant.address_line2) : null,
                address_city_encrypted: tenant.address_city ? encrypt(tenant.address_city) : null,
                address_county_encrypted: tenant.address_county ? encrypt(tenant.address_county) : null,
                address_postcode_encrypted: tenant.address_postcode ? encrypt(tenant.address_postcode) : null,
                address_country_encrypted: tenant.address_country ? encrypt(tenant.address_country) : null,
                phone_encrypted: encrypt(tenant.phone),
                email_encrypted: encrypt(tenant.email),
                annual_income_encrypted: encrypt(tenant.annual_income),
                job_title_encrypted: tenant.job_title ? encrypt(tenant.job_title) : null,
                no_ccj_bankruptcy_iva: tenant.no_ccj_bankruptcy_iva === true,
                signature_encrypted: tenant.signature ? encrypt(tenant.signature) : null,
                signature_name_encrypted: tenant.signature_name ? encrypt(tenant.signature_name) : null,
                signed_at: tenant.signature ? new Date().toISOString() : null
            }
        })

        const { error: tenantsError } = await supabase
            .from('tenant_offer_tenants')
            .insert(tenantRecords)

        if (tenantsError) {
            // Rollback offer creation
            await supabase.from('tenant_offers').delete().eq('id', offer.id)
            return res.status(400).json({ error: tenantsError.message })
        }

        // Update sent_offer_forms record to mark as submitted
        try {
            if (form_ref) {
                // New method: update by form_ref
                await supabase
                    .from('sent_offer_forms')
                    .update({
                        status: 'submitted',
                        submitted_at: new Date().toISOString(),
                        tenant_offer_id: offer.id
                    })
                    .eq('form_ref', form_ref)
                    .or('status.eq.sent,status.is.null')
            } else {
                // Legacy fallback: match by tenant email and company_id
                const tenantEmails = tenants.map((t: any) => t.email.toLowerCase())
                await supabase
                    .from('sent_offer_forms')
                    .update({
                        status: 'submitted',
                        submitted_at: new Date().toISOString(),
                        tenant_offer_id: offer.id
                    })
                    .eq('company_id', companyId)
                    .or('status.eq.sent,status.is.null')
                    .in('tenant_email', tenantEmails)
            }
        } catch (updateError: any) {
            console.error('Failed to update sent_offer_forms record:', updateError)
            // Don't fail - this is non-critical
        }

        // Get company details for email notification (already fetched above)
        const companyName = companyData?.name_encrypted ? (decrypt(companyData.name_encrypted) || 'PropertyGoose') : 'PropertyGoose'
        const companyEmail = companyData?.email_encrypted ? decrypt(companyData.email_encrypted) : null
        const notificationEmail = companyData?.offer_notification_email || companyEmail

        // Send notification email to agent
        if (notificationEmail) {
            try {
                const tenantNames = tenants.map((t: any) => t.name).join(', ')
                const propertyAddress = property_address

                // Get company branding for styled email
                const { data: brandingData } = await supabase
                    .from('companies')
                    .select('logo_url, primary_color')
                    .eq('id', companyId)
                    .single()

                const primaryColor = brandingData?.primary_color || '#f97316'
                const logoUrl = brandingData?.logo_url || null
                const formattedMoveIn = proposed_move_in_date
                    ? new Date(proposed_move_in_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
                    : 'To be confirmed'
                const depositText = deposit_amount ? `£${Number(deposit_amount).toLocaleString()}` : 'Standard'
                const viewUrl = `${frontendUrl}/tenant-offers/${offer.id}`

                const logoHtml = logoUrl
                    ? `<img src="${logoUrl}" alt="${companyName}" style="max-height: 40px; max-width: 180px;" />`
                    : `<span style="font-size: 18px; font-weight: 700; color: #ffffff;">${companyName}</span>`

                // Build tenant cards
                const tenantCardsHtml = tenants.map((t: any, i: number) => `
                    <tr>
                        <td style="padding: 4px 0;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f9fafb; border-radius: 6px;">
                                <tr>
                                    <td width="36" style="padding: 10px;">
                                        <div style="width: 28px; height: 28px; background-color: ${primaryColor}20; color: ${primaryColor}; border-radius: 50%; text-align: center; line-height: 28px; font-size: 12px; font-weight: 600;">${i + 1}</div>
                                    </td>
                                    <td style="padding: 10px 10px 10px 0;">
                                        <p style="margin: 0; font-size: 14px; font-weight: 600; color: #111827;">${t.name}</p>
                                        <p style="margin: 2px 0 0 0; font-size: 12px; color: #6b7280;">${t.email}${t.phone ? ` &middot; ${t.phone}` : ''}</p>
                                    </td>
                                    <td width="90" align="right" style="padding: 10px;">
                                        ${t.annual_income && t.annual_income !== 'Student'
                                            ? `<p style="margin: 0; font-size: 13px; font-weight: 700; color: #16a34a;">£${t.annual_income}</p><p style="margin: 0; font-size: 10px; color: #9ca3af;">per year</p>`
                                            : t.annual_income === 'Student'
                                                ? `<p style="margin: 0; font-size: 12px; font-weight: 600; color: ${primaryColor};">Student</p>`
                                                : ''}
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                `).join('')

                const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f3f4f6;">
        <tr><td align="center" style="padding: 24px 16px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 560px;">
                <!-- Header -->
                <tr>
                    <td style="background-color: ${primaryColor}; border-radius: 12px 12px 0 0; padding: 24px 28px; text-align: center;">
                        ${logoHtml}
                    </td>
                </tr>

                <!-- Body -->
                <tr>
                    <td style="background-color: #ffffff; padding: 28px;">
                        <!-- Title -->
                        <h1 style="margin: 0 0 6px 0; font-size: 22px; font-weight: 700; color: #111827;">New Offer Received</h1>
                        <p style="margin: 0 0 24px 0; font-size: 14px; color: #6b7280;">A tenant has submitted an offer for your review.</p>

                        <!-- Property Card -->
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: ${primaryColor}10; border: 1px solid ${primaryColor}30; border-radius: 8px; margin-bottom: 20px;">
                            <tr>
                                <td style="padding: 16px;">
                                    <p style="margin: 0; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: ${primaryColor};">Property</p>
                                    <p style="margin: 4px 0 0 0; font-size: 16px; font-weight: 700; color: #111827;">${propertyAddress}</p>
                                    ${property_city ? `<p style="margin: 2px 0 0 0; font-size: 13px; color: #6b7280;">${property_city}${property_postcode ? ', ' + property_postcode : ''}</p>` : ''}
                                </td>
                            </tr>
                        </table>

                        <!-- Offer Terms Grid -->
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 20px;">
                            <tr>
                                <td width="50%" style="padding: 0 8px 12px 0; vertical-align: top;">
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f9fafb; border-radius: 8px;">
                                        <tr><td style="padding: 14px;">
                                            <p style="margin: 0; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #9ca3af;">Monthly Rent</p>
                                            <p style="margin: 4px 0 0 0; font-size: 20px; font-weight: 700; color: #111827;">£${Number(offered_rent_amount).toLocaleString()}</p>
                                        </td></tr>
                                    </table>
                                </td>
                                <td width="50%" style="padding: 0 0 12px 8px; vertical-align: top;">
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f9fafb; border-radius: 8px;">
                                        <tr><td style="padding: 14px;">
                                            <p style="margin: 0; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #9ca3af;">Move-in Date</p>
                                            <p style="margin: 4px 0 0 0; font-size: 16px; font-weight: 700; color: #111827;">${formattedMoveIn}</p>
                                        </td></tr>
                                    </table>
                                </td>
                            </tr>
                            <tr>
                                <td width="50%" style="padding: 0 8px 0 0; vertical-align: top;">
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f9fafb; border-radius: 8px;">
                                        <tr><td style="padding: 14px;">
                                            <p style="margin: 0; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #9ca3af;">Tenancy Length</p>
                                            <p style="margin: 4px 0 0 0; font-size: 16px; font-weight: 700; color: #111827;">${proposed_tenancy_length_months} months</p>
                                        </td></tr>
                                    </table>
                                </td>
                                <td width="50%" style="padding: 0 0 0 8px; vertical-align: top;">
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f9fafb; border-radius: 8px;">
                                        <tr><td style="padding: 14px;">
                                            <p style="margin: 0; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #9ca3af;">Deposit</p>
                                            <p style="margin: 4px 0 0 0; font-size: 16px; font-weight: 700; color: #111827;">${depositText}</p>
                                        </td></tr>
                                    </table>
                                </td>
                            </tr>
                        </table>

                        <!-- Tenants -->
                        <p style="margin: 0 0 8px 0; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #9ca3af;">Applicants (${tenants.length})</p>
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 24px;">
                            ${tenantCardsHtml}
                        </table>

                        ${special_conditions ? `
                        <!-- Special Conditions -->
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; margin-bottom: 24px;">
                            <tr><td style="padding: 14px;">
                                <p style="margin: 0 0 4px 0; font-size: 12px; font-weight: 600; color: #92400e;">Special Conditions</p>
                                <p style="margin: 0; font-size: 13px; color: #92400e; line-height: 1.5;">${special_conditions}</p>
                            </td></tr>
                        </table>
                        ` : ''}

                        <!-- CTA Button -->
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                            <tr><td align="center">
                                <a href="${viewUrl}" style="display: inline-block; background-color: ${primaryColor}; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; padding: 12px 32px; border-radius: 8px;">
                                    Review Offer
                                </a>
                            </td></tr>
                        </table>
                    </td>
                </tr>

                <!-- Footer -->
                <tr>
                    <td style="background-color: #f9fafb; border-radius: 0 0 12px 12px; padding: 16px 28px; text-align: center; border-top: 1px solid #e5e7eb;">
                        <p style="margin: 0; font-size: 11px; color: #9ca3af;">This is an automated notification from PropertyGoose on behalf of ${companyName}.</p>
                    </td>
                </tr>
            </table>
        </td></tr>
    </table>
</body>
</html>`

                await sendEmail({
                    to: notificationEmail,
                    subject: `New Tenant Offer - ${propertyAddress} - ${companyName}`,
                    html: emailHtml
                })
            } catch (emailError) {
                console.error('Failed to send offer notification email:', emailError)
                // Don't fail the request if email fails
            }
        }

        // Create in-app notification
        try {
            const { notifyTenantOffer } = await import('../services/notificationService')
            const tenantNames = tenants.map((t: any) => t.name).join(', ')
            await notifyTenantOffer(companyId, offer.id, property_address, tenantNames)
        } catch (notifError) {
            console.error('Failed to create offer notification:', notifError)
        }

        // Log property audit if property is linked
        if (linked_property_id) {
            try {
                const tenantNames = tenants.map((t: any) => t.name).join(', ')
                await auditOfferCompleted(
                    linked_property_id,
                    companyId,
                    tenantNames,
                    offer.id
                )
            } catch (auditError: any) {
                console.error('Failed to log property audit:', auditError)
                // Don't fail - audit logging is non-critical
            }
        }

        // Send confirmation email to lead tenant
        try {
            // Get company branding
            const { data: companyBranding } = await supabase
                .from('companies')
                .select('logo_url, primary_color')
                .eq('id', companyId)
                .single()

            const leadTenant = tenants[0]
            await sendTenantOfferConfirmation({
                tenantEmail: leadTenant.email,
                tenantName: leadTenant.name,
                propertyAddress: property_address,
                propertyCity: property_city,
                propertyPostcode: property_postcode,
                monthlyRent: parseFloat(offered_rent_amount),
                moveInDate: proposed_move_in_date,
                tenancyLength: parseInt(proposed_tenancy_length_months),
                depositAmount: finalDepositAmount,
                specialConditions: special_conditions,
                tenants: tenants.map((t: any) => ({
                    name: t.name,
                    email: t.email,
                    phone: t.phone,
                    address: t.address,
                    jobTitle: t.job_title,
                    annualIncome: t.annual_income,
                    signature: t.signature,
                    signatureName: t.signature_name,
                    signedAt: new Date().toISOString()
                })),
                companyName,
                companyPhone: companyData?.phone_encrypted ? (decrypt(companyData.phone_encrypted) || undefined) : undefined,
                companyEmail: companyData?.email_encrypted ? (decrypt(companyData.email_encrypted) || undefined) : undefined,
                companyLogoUrl: companyBranding?.logo_url,
                primaryColor: companyBranding?.primary_color || '#f97316',
                offerId: offer.id
            })
        } catch (emailError: any) {
            console.error('Failed to send offer confirmation email:', emailError)
            // Don't fail the request - email is non-critical
        }

        res.status(201).json({
            success: true,
            message: 'Offer submitted successfully',
            offer: {
                id: offer.id,
                status: offer.status
            }
        })
    } catch (error: any) {
        console.error('Error submitting offer:', error)
        res.status(500).json({ error: error.message })
    }
})

// Confirm payment - public endpoint called when tenant clicks "I've Paid"
router.post('/confirm-payment', async (req, res) => {
    try {
        const { offer_id } = req.body

        if (!offer_id) {
            return res.status(400).json({ error: 'Offer ID is required' })
        }

        // Get offer with company details
        const { data: offer, error: offerError } = await supabase
            .from('tenant_offers')
            .select(`
                *,
                tenant_offer_tenants (*),
                companies:company_id (
                    name_encrypted,
                    email_encrypted,
                    offer_notification_email
                )
            `)
            .eq('id', offer_id)
            .single()

        if (offerError || !offer) {
            return res.status(404).json({ error: 'Offer not found' })
        }

        // Only allow confirmation for approved offers
        if (offer.status !== 'approved') {
            return res.status(400).json({ error: 'Offer is not in approved status' })
        }

        // Check if already confirmed (idempotent - return success)
        if (offer.tenant_payment_confirmed_at) {
            return res.json({
                success: true,
                message: 'Payment confirmation already recorded',
                already_confirmed: true
            })
        }

        // Update offer with payment confirmation timestamp
        const { error: updateError } = await supabase
            .from('tenant_offers')
            .update({
                tenant_payment_confirmed_at: new Date().toISOString()
            })
            .eq('id', offer_id)

        if (updateError) {
            console.error('Error updating offer:', updateError)
            return res.status(500).json({ error: 'Failed to record payment confirmation' })
        }

        // Get company and notification details
        const company = (offer as any).companies
        const companyName = company?.name_encrypted ? (decrypt(company.name_encrypted) || 'PropertyGoose') : 'PropertyGoose'
        const companyEmail = company?.email_encrypted ? decrypt(company.email_encrypted) : null
        const notificationEmail = company?.offer_notification_email || companyEmail

        // Get company logo
        const { data: companyBrandingData } = await supabase
            .from('companies')
            .select('logo_url')
            .eq('id', offer.company_id)
            .single()
        const companyLogoUrl = companyBrandingData?.logo_url || null

        if (notificationEmail) {
            try {
                // Get property address
                const propertyAddress = offer.property_address_encrypted
                    ? (decrypt(offer.property_address_encrypted) || 'Property address not available')
                    : 'Property address not available'

                // Get tenant names
                const tenantNames = (offer.tenant_offer_tenants || [])
                    .map((tenant: any) => tenant.name_encrypted ? decrypt(tenant.name_encrypted) : '')
                    .filter(Boolean)
                    .join(', ')

                // Calculate holding deposit
                const holdingDeposit = Math.floor((offer.offered_rent_amount * 12) / 52)
                const holdingDepositAmount = `£${holdingDeposit.toFixed(2)}`

                // Generate offer link
                const frontendBaseUrl = frontendUrl
                const offerLink = `${frontendBaseUrl}/tenant-offers/${offer_id}`

                await sendPaymentConfirmedToAgentEmail(
                    notificationEmail,
                    propertyAddress,
                    tenantNames,
                    holdingDepositAmount,
                    offerLink,
                    companyName,
                    companyLogoUrl
                )
            } catch (emailError) {
                console.error('Failed to send payment confirmation email to agent:', emailError)
                // Don't fail the request if email fails
            }
        }

        // Log audit action
        await logOfferAuditAction({
            offerId: offer_id,
            action: 'TENANT_PAYMENT_CONFIRMED',
            description: 'Tenant confirmed holding deposit payment'
        })

        res.json({
            success: true,
            message: 'Payment confirmation recorded and agent notified'
        })
    } catch (error: any) {
        console.error('Error confirming payment:', error)
        res.status(500).json({ error: error.message })
    }
})

// =====================================================================
// AUTHENTICATED ROUTES - /:id must come AFTER specific path routes
// =====================================================================

// Get single offer by ID
router.get('/:id', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const userId = req.user?.id
        const { id } = req.params

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' })
        }

        // Get company ID with branch isolation support
        const companyId = await getCompanyIdForRequest(req)
        if (!companyId) {
            return res.status(404).json({ error: 'Company not found' })
        }

        // Get offer with tenants
        const { data: offer, error } = await supabase
            .from('tenant_offers')
            .select(`
        *,
        tenant_offer_tenants (
          id,
          tenant_order,
          name_encrypted,
          first_name_encrypted,
          last_name_encrypted,
          address_encrypted,
          phone_encrypted,
          email_encrypted,
          annual_income_encrypted,
          job_title_encrypted,
          no_ccj_bankruptcy_iva,
          signature_encrypted,
          signature_name_encrypted,
          signed_at,
          rent_share,
          rent_share_percentage
        )
      `)
            .eq('id', id)
            .eq('company_id', companyId)
            .single()

        if (error || !offer) {
            return res.status(404).json({ error: 'Offer not found' })
        }

        // Decrypt offer data
        const tenants = (offer.tenant_offer_tenants || []).map((tenant: any) => ({
            id: tenant.id,
            tenant_order: tenant.tenant_order,
            name: tenant.name_encrypted ? decrypt(tenant.name_encrypted) : '',
            address: tenant.address_encrypted ? decrypt(tenant.address_encrypted) : '',
            address_line2: tenant.address_line2_encrypted ? decrypt(tenant.address_line2_encrypted) : '',
            address_city: tenant.address_city_encrypted ? decrypt(tenant.address_city_encrypted) : '',
            address_county: tenant.address_county_encrypted ? decrypt(tenant.address_county_encrypted) : '',
            address_postcode: tenant.address_postcode_encrypted ? decrypt(tenant.address_postcode_encrypted) : '',
            address_country: tenant.address_country_encrypted ? decrypt(tenant.address_country_encrypted) : '',
            phone: tenant.phone_encrypted ? decrypt(tenant.phone_encrypted) : '',
            email: tenant.email_encrypted ? decrypt(tenant.email_encrypted) : '',
            annual_income: tenant.annual_income_encrypted ? decrypt(tenant.annual_income_encrypted) : '',
            job_title: tenant.job_title_encrypted ? decrypt(tenant.job_title_encrypted) : '',
            no_ccj_bankruptcy_iva: tenant.no_ccj_bankruptcy_iva,
            signature: tenant.signature_encrypted ? decrypt(tenant.signature_encrypted) : '',
            signature_name: tenant.signature_name_encrypted ? decrypt(tenant.signature_name_encrypted) : '',
            signed_at: tenant.signed_at,
            rent_share: tenant.rent_share,
            rent_share_percentage: tenant.rent_share_percentage
        }))

        const decrypted = {
            ...offer,
            property_address: offer.property_address_encrypted ? decrypt(offer.property_address_encrypted) : '',
            property_city: offer.property_city_encrypted ? decrypt(offer.property_city_encrypted) : '',
            property_postcode: offer.property_postcode_encrypted ? decrypt(offer.property_postcode_encrypted) : '',
            special_conditions: offer.special_conditions_encrypted ? decrypt(offer.special_conditions_encrypted) : '',
            declined_reason: offer.declined_reason_encrypted ? decrypt(offer.declined_reason_encrypted) : '',
            tenants: tenants.sort((a: any, b: any) => a.tenant_order - b.tenant_order)
        }

        res.json({ offer: decrypted })
    } catch (error: any) {
        console.error('Error fetching offer:', error)
        res.status(500).json({ error: error.message })
    }
})

// Approve offer (sends email with bank details and, if applicable, updated terms)
router.post('/:id/approve', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const userId = req.user?.id
        const { id } = req.params
        const { accept_with_changes, changes } = req.body

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' })
        }

        // Get company from X-Branch-Id header or user's company
        const companyId = await getCompanyIdForRequest(req)
        if (!companyId) {
            return res.status(404).json({ error: 'Company not found' })
        }

        // Get offer (with tenants and company for email)
        const { data: offer, error: offerError } = await supabase
            .from('tenant_offers')
            .select(`
        *,
        tenant_offer_tenants (*),
        companies:company_id (
          name_encrypted,
          phone_encrypted,
          email_encrypted,
          bank_account_name,
          bank_account_number,
          bank_sort_code,
          logo_url
        )
      `)
            .eq('id', id)
            .eq('company_id', companyId)
            .single()

        if (offerError || !offer) {
            return res.status(404).json({ error: 'Offer not found' })
        }

        const wasAcceptedWithChanges = offer.status === 'accepted_with_changes' || accept_with_changes

        if (offer.status !== 'pending' && offer.status !== 'accepted_with_changes') {
            return res.status(400).json({ error: 'Offer cannot be approved in its current status' })
        }

        // Build update object
        const updateData: Record<string, any> = {
            status: 'approved',
            approved_at: new Date().toISOString(),
            approved_by: userId
        }

        // Apply changes if provided (Accept with Changes flow)
        if (accept_with_changes && changes) {
            if (changes.offered_rent_amount !== undefined && changes.offered_rent_amount !== null) {
                updateData.offered_rent_amount = changes.offered_rent_amount
            }
            if (changes.proposed_move_in_date) {
                updateData.proposed_move_in_date = changes.proposed_move_in_date
            }
            if (changes.proposed_tenancy_length_months !== undefined && changes.proposed_tenancy_length_months !== null) {
                updateData.proposed_tenancy_length_months = changes.proposed_tenancy_length_months
            }
            if (changes.deposit_amount !== undefined && changes.deposit_amount !== null) {
                updateData.deposit_amount = changes.deposit_amount
            }
        }

        // Update offer status
        const { error: updateError } = await supabase
            .from('tenant_offers')
            .update(updateData)
            .eq('id', id)

        if (updateError) {
            return res.status(400).json({ error: updateError.message })
        }

        // Update Apex27 listing status to "Let Agreed" if property is linked
        try {
            if (offer.linked_property_id) {
                const { data: property } = await supabase
                    .from('properties')
                    .select('apex27_listing_id, company_id')
                    .eq('id', offer.linked_property_id)
                    .single()

                if (property?.apex27_listing_id) {
                    const { data: integration } = await supabase
                        .from('company_integrations')
                        .select('apex27_api_key_encrypted')
                        .eq('company_id', property.company_id)
                        .single()

                    if (integration?.apex27_api_key_encrypted) {
                        const apiKey = decrypt(integration.apex27_api_key_encrypted)
                        if (apiKey) {
                            // First GET the current listing to preserve required fields
                            const getResponse = await fetch(`https://api.apex27.co.uk/listings/${property.apex27_listing_id}`, {
                                headers: { 'X-Api-Key': apiKey }
                            })
                            if (getResponse.ok) {
                                const listing: any = await getResponse.json()
                                const apex27Response = await fetch(`https://api.apex27.co.uk/listings/${property.apex27_listing_id}`, {
                                    method: 'PUT',
                                    headers: {
                                        'X-Api-Key': apiKey,
                                        'Content-Type': 'application/json'
                                    },
                                    body: JSON.stringify({
                                        branchId: listing.branchId,
                                        transactionType: listing.transactionType || 'rent',
                                        propertyType: listing.propertyType || 'house',
                                        bedrooms: listing.bedrooms || 1,
                                        bathrooms: listing.bathrooms || 1,
                                        status: 'let_agreed'
                                    })
                                })
                                if (apex27Response.ok) {
                                    console.log(`[Apex27] Updated listing ${property.apex27_listing_id} to let_agreed`)
                                } else {
                                    const errText = await apex27Response.text()
                                    console.warn(`[Apex27] Failed to update listing status: ${apex27Response.status} - ${errText}`)
                                }
                            }
                        }
                    }
                }
            }
        } catch (apex27Err) {
            console.error('[Apex27] Error updating listing status:', apex27Err)
            // Non-blocking - don't fail the offer approval
        }

        // Get company and decrypted details
        const company = (offer as any).companies
        const companyName = company?.name_encrypted ? (decrypt(company.name_encrypted) || 'PropertyGoose') : 'PropertyGoose'
        const companyPhone = company?.phone_encrypted ? (decrypt(company.phone_encrypted) || '') : ''
        const companyEmail = company?.email_encrypted ? (decrypt(company.email_encrypted) || '') : ''
        const companyLogoUrl = company?.logo_url || null
        const bankAccountName = company?.bank_account_name || ''
        const bankAccountNumber = company?.bank_account_number || ''
        const bankSortCode = company?.bank_sort_code || ''

        // Use updated values if changes were applied, otherwise use original offer values
        const finalRentAmount = (accept_with_changes && changes?.offered_rent_amount) ? changes.offered_rent_amount : offer.offered_rent_amount
        const finalMoveInDate = (accept_with_changes && changes?.proposed_move_in_date) ? changes.proposed_move_in_date : offer.proposed_move_in_date
        const finalTenancyLength = (accept_with_changes && changes?.proposed_tenancy_length_months) ? changes.proposed_tenancy_length_months : offer.proposed_tenancy_length_months
        const finalDepositAmount = (accept_with_changes && changes?.deposit_amount) ? changes.deposit_amount : offer.deposit_amount

        // Calculate holding deposit (one week's rent, rounded down to nearest pound)
        const holdingDeposit = Math.floor((finalRentAmount * 12) / 52)

        // Decrypt property and terms
        const propertyAddress = offer.property_address_encrypted ? decrypt(offer.property_address_encrypted) : ''
        const propertyCity = offer.property_city_encrypted ? decrypt(offer.property_city_encrypted) : ''
        const propertyPostcode = offer.property_postcode_encrypted ? decrypt(offer.property_postcode_encrypted) : ''
        const specialConditions = offer.special_conditions_encrypted ? decrypt(offer.special_conditions_encrypted) : ''

        const tenancyLengthMonths = finalTenancyLength
        const moveInDate = finalMoveInDate
            ? new Date(finalMoveInDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
            : 'To be confirmed'
        const depositAmount = finalDepositAmount

        // Get tenant emails
        const tenantEmails = (offer.tenant_offer_tenants || []).map((tenant: any) =>
            tenant.email_encrypted ? decrypt(tenant.email_encrypted) : ''
        ).filter(Boolean)

        // Build extra details block if the offer was accepted with changes
        let extraDetailsHtml = ''

        if (wasAcceptedWithChanges) {
            const addressLine = `${propertyAddress}${propertyCity ? ', ' + propertyCity : ''}${propertyPostcode ? ', ' + propertyPostcode : ''}`

            extraDetailsHtml = `
        <div style="margin: 0 0 24px; font-size: 15px; line-height: 22px; color: #4b5563;">
          <p style="margin: 0 0 12px;">
            <strong>Your offer has been accepted with some minor changes.</strong>
          </p>
          <p style="margin: 0 0 12px;">
            These are the agreed terms now recorded in our system:
          </p>
          <ul style="margin: 0 0 12px 18px; padding: 0;">
            <li style="margin-bottom: 4px;"><strong>Property:</strong> ${addressLine}</li>
            <li style="margin-bottom: 4px;"><strong>Offered Rent:</strong> £${finalRentAmount} per month</li>
            <li style="margin-bottom: 4px;"><strong>Proposed Move-in Date:</strong> ${moveInDate}</li>
            <li style="margin-bottom: 4px;"><strong>Tenancy Length:</strong> ${tenancyLengthMonths} months</li>
            ${depositAmount ? `<li style="margin-bottom: 4px;"><strong>Deposit Amount:</strong> £${depositAmount}</li>` : ''}
          </ul>
          ${specialConditions ? `
          <p style="margin: 0 0 12px;">
            <strong>Special conditions:</strong> ${specialConditions.replace(/\n/g, '<br/>')}
          </p>
          ` : ''}
          <p style="margin: 0;">
            To proceed, simply pay the holding deposit using the bank details below and then click the
            <strong>"I've Paid"</strong> button in your offer portal. This will jog your agent to get your references
            started.
          </p>
        </div>
        `
        }

        // Send approval email with bank details to all tenants using the shared template
        for (const email of tenantEmails) {
            try {
                await sendOfferAcceptedEmail(
                    email,
                    companyName,
                    bankAccountName,
                    bankAccountNumber,
                    bankSortCode,
                    holdingDeposit,
                    id,
                    companyPhone || undefined,
                    companyEmail || undefined,
                    extraDetailsHtml,
                    companyLogoUrl
                )
            } catch (emailError) {
                console.error(`Failed to send approval email to ${email}:`, emailError)
            }
        }

        // Log audit action
        await logOfferAuditAction({
            offerId: id,
            action: 'OFFER_APPROVED',
            description: `Offer approved${wasAcceptedWithChanges ? ' (with changes)' : ''}`,
            metadata: { holding_deposit: holdingDeposit },
            userId
        })

        await logOfferAuditAction({
            offerId: id,
            action: 'APPROVAL_EMAIL_SENT',
            description: `Approval email sent to ${tenantEmails.length} tenant(s)`,
            metadata: { recipients: tenantEmails },
            userId
        })

        // Log property audit if property is linked
        if (offer.linked_property_id) {
            const leadTenant = (offer.tenant_offer_tenants || [])[0]
            const tenantName = leadTenant?.name_encrypted ? decrypt(leadTenant.name_encrypted) : 'Tenant'
            try {
                await auditOfferAccepted(offer.linked_property_id, companyId, userId, tenantName || 'Tenant', id)
            } catch (auditError) {
                console.error('Failed to log property audit:', auditError)
            }
        }

        res.json({
            success: true,
            message: 'Offer approved and email sent to tenants',
            holding_deposit_amount: holdingDeposit
        })
    } catch (error: any) {
        console.error('Error approving offer:', error)
        res.status(500).json({ error: error.message })
    }
})

// Decline offer
router.post('/:id/decline', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const userId = req.user?.id
        const { id } = req.params
        const { reason } = req.body

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' })
        }

        if (!reason) {
            return res.status(400).json({ error: 'Decline reason is required' })
        }

        // Get company from X-Branch-Id header or user's company
        const companyId = await getCompanyIdForRequest(req)
        if (!companyId) {
            return res.status(404).json({ error: 'Company not found' })
        }

        // Get offer
        const { data: offer, error: offerError } = await supabase
            .from('tenant_offers')
            .select(`
        *,
        tenant_offer_tenants (*),
        companies:company_id (name_encrypted, phone_encrypted, email_encrypted, logo_url)
      `)
            .eq('id', id)
            .eq('company_id', companyId)
            .single()

        if (offerError || !offer) {
            return res.status(404).json({ error: 'Offer not found' })
        }

        if (offer.status !== 'pending' && offer.status !== 'accepted_with_changes') {
            return res.status(400).json({ error: 'Offer cannot be declined in its current status' })
        }

        // Update offer status
        const { error: updateError } = await supabase
            .from('tenant_offers')
            .update({
                status: 'declined',
                declined_at: new Date().toISOString(),
                declined_by: userId,
                declined_reason_encrypted: encrypt(reason)
            })
            .eq('id', id)

        if (updateError) {
            return res.status(400).json({ error: updateError.message })
        }

        // Get company details
    const company = (offer as any).companies
    const companyName = company?.name_encrypted ? (decrypt(company.name_encrypted) || 'PropertyGoose') : 'PropertyGoose'
    const companyPhone = company?.phone_encrypted ? (decrypt(company.phone_encrypted) || '') : ''
    const companyEmail = company?.email_encrypted ? (decrypt(company.email_encrypted) || '') : ''
    const companyLogoUrl = company?.logo_url || null

        // Get tenant emails
        const tenantEmails = (offer.tenant_offer_tenants || []).map((tenant: any) =>
            tenant.email_encrypted ? decrypt(tenant.email_encrypted) : ''
        ).filter(Boolean)

        // Send decline email to all tenants
        for (const email of tenantEmails) {
            try {
                await sendOfferDeclinedEmail(
                    email,
                    companyName,
            reason,
            companyPhone || undefined,
            companyEmail || undefined,
            companyLogoUrl
                )
            } catch (emailError) {
                console.error(`Failed to send decline email to ${email}:`, emailError)
            }
        }

        // Log audit action
        await logOfferAuditAction({
            offerId: id,
            action: 'OFFER_DECLINED',
            description: `Offer declined: ${reason.substring(0, 100)}${reason.length > 100 ? '...' : ''}`,
            metadata: { reason },
            userId
        })

        await logOfferAuditAction({
            offerId: id,
            action: 'DECLINE_EMAIL_SENT',
            description: `Decline email sent to ${tenantEmails.length} tenant(s)`,
            metadata: { recipients: tenantEmails },
            userId
        })

        // Log property audit if property is linked
        if (offer.linked_property_id) {
            const leadTenant = (offer.tenant_offer_tenants || [])[0]
            const tenantName = leadTenant?.name_encrypted ? decrypt(leadTenant.name_encrypted) : 'Tenant'
            try {
                await auditOfferRejected(offer.linked_property_id, companyId, userId, tenantName || 'Tenant', id, reason)
            } catch (auditError) {
                console.error('Failed to log property audit:', auditError)
            }
        }

        res.json({
            success: true,
            message: 'Offer declined and email sent to tenants'
        })
    } catch (error: any) {
        console.error('Error declining offer:', error)
        res.status(500).json({ error: error.message })
    }
})

// Accept with changes (update offer)
router.put('/:id', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const userId = req.user?.id
        const { id } = req.params
        const {
            property_address,
            property_city,
            property_postcode,
            offered_rent_amount,
            proposed_move_in_date,
            proposed_tenancy_length_months,
            deposit_amount,
            special_conditions,
            tenants
        } = req.body

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' })
        }

        // Get company from X-Branch-Id header or user's company
        const companyId = await getCompanyIdForRequest(req)
        if (!companyId) {
            return res.status(404).json({ error: 'Company not found' })
        }

        // Get offer
        const { data: offer, error: offerError } = await supabase
            .from('tenant_offers')
            .select('*')
            .eq('id', id)
            .eq('company_id', companyId)
            .single()

        if (offerError || !offer) {
            return res.status(404).json({ error: 'Offer not found' })
        }

        // Update offer
        const updateData: any = {
            updated_at: new Date().toISOString()
        }

        if (property_address !== undefined) updateData.property_address_encrypted = encrypt(property_address)
        if (property_city !== undefined) updateData.property_city_encrypted = property_city ? encrypt(property_city) : null
        if (property_postcode !== undefined) updateData.property_postcode_encrypted = property_postcode ? encrypt(property_postcode) : null
        if (offered_rent_amount !== undefined) updateData.offered_rent_amount = parseFloat(offered_rent_amount)
        if (proposed_move_in_date !== undefined) updateData.proposed_move_in_date = proposed_move_in_date
        if (proposed_tenancy_length_months !== undefined) updateData.proposed_tenancy_length_months = parseInt(proposed_tenancy_length_months)
        if (deposit_amount !== undefined) updateData.deposit_amount = deposit_amount ? parseFloat(deposit_amount) : null
        if (special_conditions !== undefined) updateData.special_conditions_encrypted = special_conditions ? encrypt(special_conditions) : null

        // If status is pending, change to accepted_with_changes
        if (offer.status === 'pending') {
            updateData.status = 'accepted_with_changes'
            updateData.accepted_with_changes_at = new Date().toISOString()
            updateData.accepted_with_changes_by = userId
        }

        const { error: updateError } = await supabase
            .from('tenant_offers')
            .update(updateData)
            .eq('id', id)

        if (updateError) {
            return res.status(400).json({ error: updateError.message })
        }

        // Update tenants if provided
        if (tenants && Array.isArray(tenants)) {
            // Delete existing tenants
            await supabase.from('tenant_offer_tenants').delete().eq('tenant_offer_id', id)

            // Insert updated tenants
            const tenantRecords = tenants.map((tenant: any, index: number) => {
                const firstName = tenant.first_name || ''
                const lastName = tenant.last_name || ''
                const fullName = tenant.name || `${firstName} ${lastName}`.trim()
                return {
                    tenant_offer_id: id,
                    tenant_order: index + 1,
                    name_encrypted: encrypt(fullName),
                    first_name_encrypted: firstName ? encrypt(firstName) : null,
                    last_name_encrypted: lastName ? encrypt(lastName) : null,
                    address_encrypted: encrypt(tenant.address),
                    phone_encrypted: encrypt(tenant.phone),
                    email_encrypted: encrypt(tenant.email),
                    annual_income_encrypted: encrypt(tenant.annual_income),
                    job_title_encrypted: tenant.job_title ? encrypt(tenant.job_title) : null,
                    no_ccj_bankruptcy_iva: tenant.no_ccj_bankruptcy_iva === true,
                    signature_encrypted: tenant.signature ? encrypt(tenant.signature) : null,
                    signature_name_encrypted: tenant.signature_name ? encrypt(tenant.signature_name) : null,
                    signed_at: tenant.signature ? new Date().toISOString() : null
                }
            })

            const { error: tenantsError } = await supabase
                .from('tenant_offer_tenants')
                .insert(tenantRecords)

            if (tenantsError) {
                return res.status(400).json({ error: tenantsError.message })
            }
        }

        // Log audit action
        await logOfferAuditAction({
            offerId: id,
            action: 'OFFER_UPDATED',
            description: offer.status === 'pending' ? 'Offer accepted with changes' : 'Offer details updated',
            metadata: { changes: updateData },
            userId
        })

        res.json({
            success: true,
            message: 'Offer updated successfully'
        })
    } catch (error: any) {
        console.error('Error updating offer:', error)
        res.status(500).json({ error: error.message })
    }
})


// Delete offer
router.delete('/:id', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const userId = req.user?.id
        const { id } = req.params

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' })
        }

        // Get company from X-Branch-Id header or user's company
        const companyId = await getCompanyIdForRequest(req)
        if (!companyId) {
            return res.status(404).json({ error: 'Company not found' })
        }

        // Verify offer belongs to this company
        const { data: offer, error: offerError } = await supabase
            .from('tenant_offers')
            .select('id, company_id')
            .eq('id', id)
            .eq('company_id', companyId)
            .single()

        if (offerError || !offer) {
            return res.status(404).json({ error: 'Offer not found' })
        }

        // Delete linked sent_offer_forms first
        await supabase
            .from('sent_offer_forms')
            .delete()
            .eq('tenant_offer_id', id)

        // Delete tenants to avoid orphan records
        await supabase
            .from('tenant_offer_tenants')
            .delete()
            .eq('tenant_offer_id', id)

        // Delete offer
        const { error: deleteError } = await supabase
            .from('tenant_offers')
            .delete()
            .eq('id', id)

        if (deleteError) {
            return res.status(400).json({ error: deleteError.message })
        }

        res.json({
            success: true,
            message: 'Offer deleted successfully'
        })
    } catch (error: any) {
        console.error('Error deleting offer:', error)
        res.status(500).json({ error: error.message })
    }
})

// Set rent shares for tenants
router.post('/:id/set-rent-shares', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const userId = req.user?.id
        const { id } = req.params
        const { tenantShares } = req.body // [{ tenantId, rentShare }]

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' })
        }

        if (!tenantShares || !Array.isArray(tenantShares) || tenantShares.length === 0) {
            return res.status(400).json({ error: 'Tenant shares are required' })
        }

        // Get company from X-Branch-Id header or user's company
        const companyId = await getCompanyIdForRequest(req)
        if (!companyId) {
            return res.status(404).json({ error: 'Company not found' })
        }

        // Get offer to verify ownership and get rent amount
        const { data: offer, error: offerError } = await supabase
            .from('tenant_offers')
            .select('id, offered_rent_amount, company_id')
            .eq('id', id)
            .eq('company_id', companyId)
            .single()

        if (offerError || !offer) {
            return res.status(404).json({ error: 'Offer not found' })
        }

        // Validate sum of rent shares equals offered_rent_amount
        const totalShares = tenantShares.reduce((sum: number, ts: any) => sum + (parseFloat(ts.rentShare) || 0), 0)
        const tolerance = 0.01 // Allow small rounding differences
        if (Math.abs(totalShares - offer.offered_rent_amount) > tolerance) {
            return res.status(400).json({
                error: `Total rent shares (£${totalShares.toFixed(2)}) must equal the offered rent amount (£${offer.offered_rent_amount.toFixed(2)})`
            })
        }

        // Update each tenant's rent share
        for (const ts of tenantShares) {
            const rentShare = parseFloat(ts.rentShare) || 0
            const rentSharePercentage = offer.offered_rent_amount > 0
                ? (rentShare / offer.offered_rent_amount) * 100
                : 0

            const { error: updateError } = await supabase
                .from('tenant_offer_tenants')
                .update({
                    rent_share: rentShare,
                    rent_share_percentage: rentSharePercentage
                })
                .eq('id', ts.tenantId)
                .eq('tenant_offer_id', id)

            if (updateError) {
                console.error('Error updating tenant rent share:', updateError)
                return res.status(400).json({ error: `Failed to update rent share for tenant ${ts.tenantId}` })
            }
        }

        // Log audit action
        await logOfferAuditAction({
            offerId: id,
            action: 'RENT_SHARES_SET',
            description: `Rent shares set for ${tenantShares.length} tenant(s)`,
            metadata: { tenantShares },
            userId
        })

        res.json({
            success: true,
            message: 'Rent shares updated successfully'
        })
    } catch (error: any) {
        console.error('Error setting rent shares:', error)
        res.status(500).json({ error: error.message })
    }
})

// Update tenant name (first/last) on an offer tenant
router.patch('/:id/tenant/:tenantId/name', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const userId = req.user?.id
        const { id, tenantId } = req.params
        const { first_name, last_name } = req.body

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' })
        }

        if (!first_name || !last_name) {
            return res.status(400).json({ error: 'First name and last name are required' })
        }

        const companyId = await getCompanyIdForRequest(req)
        if (!companyId) {
            return res.status(404).json({ error: 'Company not found' })
        }

        // Verify offer belongs to company
        const { data: offer, error: offerError } = await supabase
            .from('tenant_offers')
            .select('id')
            .eq('id', id)
            .eq('company_id', companyId)
            .single()

        if (offerError || !offer) {
            return res.status(404).json({ error: 'Offer not found' })
        }

        const fullName = `${first_name} ${last_name}`.trim()

        const { error: updateError } = await supabase
            .from('tenant_offer_tenants')
            .update({
                first_name_encrypted: encrypt(first_name),
                last_name_encrypted: encrypt(last_name),
                name_encrypted: encrypt(fullName)
            })
            .eq('id', tenantId)
            .eq('tenant_offer_id', id)

        if (updateError) {
            return res.status(400).json({ error: updateError.message })
        }

        await logOfferAuditAction({
            offerId: id,
            action: 'TENANT_NAME_UPDATED',
            description: `Tenant name updated to "${fullName}"`,
            metadata: { tenantId, first_name, last_name },
            userId
        })

        res.json({ success: true, message: 'Tenant name updated' })
    } catch (error: any) {
        console.error('Error updating tenant name:', error)
        res.status(500).json({ error: error.message })
    }
})

// Simple endpoint to mark offer as sent to referencing
router.post('/:id/mark-referencing', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const { id } = req.params
        const { reference_id } = req.body

        const { error } = await supabase
            .from('tenant_offers')
            .update({
                status: 'holding_deposit_received',
                holding_deposit_received_at: new Date().toISOString()
            })
            .eq('id', id)

        if (error) {
            return res.status(400).json({ error: error.message })
        }

        res.json({ success: true })
    } catch (error: any) {
        console.error('Error marking referencing:', error)
        res.status(500).json({ error: error.message })
    }
})

// Link a V2 reference to an offer (after V2 referencing conversion)
router.post('/:id/link-reference', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const userId = req.user?.id
        const { id } = req.params
        const { reference_id } = req.body

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' })
        }

        const companyId = await getCompanyIdForRequest(req)
        if (!companyId) {
            return res.status(404).json({ error: 'Company not found' })
        }

        // Update offer with reference_id
        const { data: updatedOffer, error } = await supabase
            .from('tenant_offers')
            .update({
                reference_id: reference_id,
                holding_deposit_received_at: new Date().toISOString(),
                status: 'holding_deposit_received'
            })
            .eq('id', id)
            .eq('company_id', companyId)
            .select('id')
            .single()

        if (error) {
            console.error('[link-reference] Update error:', error.message, { offerId: id, companyId, reference_id })
            return res.status(400).json({ error: error.message })
        }

        if (!updatedOffer) {
            console.error('[link-reference] No rows updated - company_id mismatch?', { offerId: id, companyId, reference_id })
            return res.status(404).json({ error: 'Offer not found or company mismatch' })
        }

        console.log('[link-reference] Success:', { offerId: id, reference_id })
        res.json({ success: true, message: 'Offer linked to reference' })
    } catch (error: any) {
        console.error('Error linking reference:', error)
        res.status(500).json({ error: error.message })
    }
})

// Mark holding deposit received and create reference
router.post('/:id/holding-deposit-received', authenticateToken, checkCredits, checkPaymentMethod, async (req: AuthRequest, res) => {
    try {
        const userId = req.user?.id
        const { id } = req.params
        const { amount_paid } = req.body

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' })
        }

        // Get company from X-Branch-Id header or user's company
        const companyId = await getCompanyIdForRequest(req)
        if (!companyId) {
            return res.status(404).json({ error: 'Company not found' })
        }

        // Get offer with company details and tenants (filtered by company)
        const { data: offerData, error: offerFetchError } = await supabase
            .from('tenant_offers')
            .select(`
                *,
                tenant_offer_tenants (*),
                companies:company_id (
                    id,
                    name_encrypted,
                    phone_encrypted,
                    email_encrypted,
                    logo_url
                )
            `)
            .eq('id', id)
            .eq('company_id', companyId)
            .single()

        if (offerFetchError || !offerData) {
            return res.status(404).json({ error: 'Offer not found' })
        }

        const company = (offerData as any).companies
        const companyName = company?.name_encrypted
            ? (decrypt(company.name_encrypted) || 'PropertyGoose')
            : 'PropertyGoose'
        const companyPhone = company?.phone_encrypted
            ? (decrypt(company.phone_encrypted) || '')
            : ''
        const companyEmail = company?.email_encrypted
            ? (decrypt(company.email_encrypted) || '')
            : ''
        const companyLogoUrl = company?.logo_url || null

        // Validate offer status
        if (offerData.status !== 'approved') {
            return res.status(400).json({ error: 'Offer must be approved before marking holding deposit as received' })
        }

        if (offerData.holding_deposit_received) {
            return res.status(400).json({ error: 'Holding deposit has already been marked as received' })
        }

        const parsedAmount = typeof amount_paid === 'number'
            ? amount_paid
            : typeof amount_paid === 'string'
                ? parseFloat(amount_paid)
                : NaN

        if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
            return res.status(400).json({ error: 'Valid holding deposit amount is required' })
        }

        // Update offer
        const { error: updateError } = await supabase
            .from('tenant_offers')
            .update({
                holding_deposit_received: true,
                holding_deposit_received_at: new Date().toISOString(),
                holding_deposit_amount_paid: parsedAmount,
                status: 'holding_deposit_received'
            })
            .eq('id', id)

        if (updateError) {
            return res.status(400).json({ error: updateError.message })
        }

        // Create expected payment for holding deposit (already received)
        try {
          const { createExpectedPayment } = await import('../services/rentgooseService')
          const { getCurrentBalance } = await import('../services/rentgooseService')

          // Get property details for the expected payment
          const propertyAddr = offerData.property_address_encrypted ? decrypt(offerData.property_address_encrypted) : ''
          const propertyPc = offerData.property_postcode_encrypted ? decrypt(offerData.property_postcode_encrypted) : ''
          const tenantName = offerData.tenant_offer_tenants?.[0]?.name_encrypted
            ? decrypt(offerData.tenant_offer_tenants[0].name_encrypted)
            : 'Tenant'

          await createExpectedPayment(companyId, {
            tenancy_id: offerData.tenancy_id || undefined,
            property_id: offerData.linked_property_id || undefined,
            payment_type: 'holding_deposit',
            source_type: 'tenant_offer',
            source_id: id,
            description: `Holding deposit - ${propertyAddr || 'Property'}`,
            amount_due: parsedAmount,
            amount_received: parsedAmount,
            status: 'paid',
            paid_at: new Date().toISOString(),
            payout_type: 'deposit_hold',
            payout_split: [{ type: 'holding_deposit', amount: parsedAmount, description: 'Holding deposit' }],
            property_address: propertyAddr || undefined,
            property_postcode: propertyPc || undefined,
            tenant_name: tenantName || undefined,
          })

          // Create holding_deposit_in client_account_entry (money already received)
          const { supabase: sb } = await import('../config/supabase')
          const currentBalance = await getCurrentBalance(companyId)
          const newBalance = currentBalance + parsedAmount

          await sb
            .from('client_account_entries')
            .insert({
              company_id: companyId,
              entry_type: 'holding_deposit_in',
              amount: parsedAmount,
              description: `Holding deposit received - ${propertyAddr || 'Property'}`,
              reference: `HD-${id.slice(0, 8).toUpperCase()}`,
              related_id: id,
              related_type: 'tenant_offer',
              balance_after: newBalance,
              created_by: userId,
              is_manual: false,
            })
        } catch (epError) {
          console.error('[RentGoose] Failed to create holding deposit expected payment:', epError)
          // Don't fail the whole request
        }

        // Use the offer data we already fetched
        const offer = offerData

        // Get tenants from offer
        // Calculate default rent share (equal split) for fallback
        const defaultRentShare = offer.offered_rent_amount / (offer.tenant_offer_tenants?.length || 1)

        const tenants = (offer.tenant_offer_tenants || []).map((tenant: any) => {
            const decryptedName = tenant.name_encrypted ? decrypt(tenant.name_encrypted) : ''
            const nameParts = decryptedName ? decryptedName.split(' ') : ['']
            // Use stored rent_share if available, otherwise fall back to equal split
            const rentShare = tenant.rent_share != null ? parseFloat(tenant.rent_share) : defaultRentShare
            return {
                first_name: nameParts[0] || '',
                last_name: nameParts.slice(1).join(' ') || '',
                email: tenant.email_encrypted ? decrypt(tenant.email_encrypted) : '',
                phone: tenant.phone_encrypted ? decrypt(tenant.phone_encrypted) : '',
                address: tenant.address_encrypted ? decrypt(tenant.address_encrypted) : '',
                address_line2: tenant.address_line2_encrypted ? decrypt(tenant.address_line2_encrypted) : '',
                address_city: tenant.address_city_encrypted ? decrypt(tenant.address_city_encrypted) : '',
                address_county: tenant.address_county_encrypted ? decrypt(tenant.address_county_encrypted) : '',
                address_postcode: tenant.address_postcode_encrypted ? decrypt(tenant.address_postcode_encrypted) : '',
                address_country: tenant.address_country_encrypted ? decrypt(tenant.address_country_encrypted) : '',
                annual_income: tenant.annual_income_encrypted ? decrypt(tenant.annual_income_encrypted) : '',
                job_title: tenant.job_title_encrypted ? decrypt(tenant.job_title_encrypted) : '',
                rent_share: rentShare.toFixed(2)
            }
        })

        const propertyAddress = offer.property_address_encrypted ? decrypt(offer.property_address_encrypted) : ''
        const propertyCity = offer.property_city_encrypted ? decrypt(offer.property_city_encrypted) : ''
        const propertyPostcode = offer.property_postcode_encrypted ? decrypt(offer.property_postcode_encrypted) : ''

        // Calculate term years and months from proposed_tenancy_length_months
        const termMonths = offer.proposed_tenancy_length_months
        const termYears = Math.floor(termMonths / 12)
        const remainingMonths = termMonths % 12

        // Token expires in 60 days
        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + 60)

        let createdReferences: any[] = []
        let referenceId: string | null = null
        const emailFailures: { email: string; reason: string }[] = []
        let emailsSent = 0

        // ============================================================
        // V2 REFERENCE CREATION (when offer is_v2 = true)
        // ============================================================
        if (offer.is_v2) {
            const { createReference } = await import('../services/v2/referenceServiceV2')
            const { sendTenantReferenceRequest: sendV2TenantEmail } = await import('../services/emailService')
            const { getV2FrontendUrl } = await import('../utils/frontendUrl')
            const v2FrontendUrl = getV2FrontendUrl()

            let parentRefId: string | null = null

            // Multi-tenant: create group parent first
            if (tenants.length > 1) {
                const parentRef = await createReference({
                    companyId,
                    tenantFirstName: tenants[0].first_name,
                    tenantLastName: tenants[0].last_name,
                    tenantEmail: tenants[0].email,
                    tenantPhone: tenants[0].phone,
                    linkedPropertyId: offer.linked_property_id || undefined,
                    propertyAddress: propertyAddress || undefined,
                    propertyCity: propertyCity || undefined,
                    propertyPostcode: propertyPostcode || undefined,
                    monthlyRent: offer.offered_rent_amount,
                    rentShare: parseFloat(tenants[0].rent_share),
                    moveInDate: offer.proposed_move_in_date,
                    termYears: termYears,
                    termMonths: remainingMonths,
                    billsIncluded: offer.bills_included || false,
                    isGroupParent: true,
                    createdBy: userId,
                    holdingDepositAmount: offer.holding_deposit_amount || undefined,
                    offerId: id
                })
                if (!parentRef) {
                    return res.status(500).json({ error: 'Failed to create V2 parent reference' })
                }
                parentRefId = parentRef.id
                referenceId = parentRef.id
            }

            // Create a V2 reference for each tenant
            for (let i = 0; i < tenants.length; i++) {
                const tenant = tenants[i]
                const isParentTenant = tenants.length > 1 && i === 0

                // For multi-tenant, skip creating separate ref for the parent tenant (already created above)
                // Actually V2 group flow: parent is group container, each tenant gets their own child ref
                const ref = tenants.length > 1 && !isParentTenant ? await createReference({
                    companyId,
                    tenantFirstName: tenant.first_name,
                    tenantLastName: tenant.last_name,
                    tenantEmail: tenant.email,
                    tenantPhone: tenant.phone,
                    linkedPropertyId: offer.linked_property_id || undefined,
                    propertyAddress: propertyAddress || undefined,
                    propertyCity: propertyCity || undefined,
                    propertyPostcode: propertyPostcode || undefined,
                    monthlyRent: offer.offered_rent_amount,
                    rentShare: parseFloat(tenant.rent_share),
                    moveInDate: offer.proposed_move_in_date,
                    termYears: termYears,
                    termMonths: remainingMonths,
                    billsIncluded: offer.bills_included || false,
                    parentReferenceId: parentRefId || undefined,
                    createdBy: userId,
                    holdingDepositAmount: offer.holding_deposit_amount || undefined,
                    offerId: id
                }) : (tenants.length === 1 ? await createReference({
                    companyId,
                    tenantFirstName: tenant.first_name,
                    tenantLastName: tenant.last_name,
                    tenantEmail: tenant.email,
                    tenantPhone: tenant.phone,
                    linkedPropertyId: offer.linked_property_id || undefined,
                    propertyAddress: propertyAddress || undefined,
                    propertyCity: propertyCity || undefined,
                    propertyPostcode: propertyPostcode || undefined,
                    monthlyRent: offer.offered_rent_amount,
                    rentShare: parseFloat(tenant.rent_share),
                    moveInDate: offer.proposed_move_in_date,
                    termYears: termYears,
                    termMonths: remainingMonths,
                    billsIncluded: offer.bills_included || false,
                    createdBy: userId,
                    holdingDepositAmount: offer.holding_deposit_amount || undefined,
                    offerId: id
                }) : null)

                // For single tenant, set referenceId from the one we just created
                if (tenants.length === 1 && ref) {
                    referenceId = ref.id
                }

                // The ref returned has _formToken for the email link
                const targetRef = isParentTenant ? null : ref
                if (!targetRef && !isParentTenant) continue

                // For the parent tenant in multi-flow, we already have the parent ref
                const refForEmail = isParentTenant ? { id: parentRefId!, _formToken: (await supabase.from('tenant_references_v2').select('form_token_hash').eq('id', parentRefId!).single()).data?.form_token_hash } : targetRef

                const formToken = (targetRef as any)?._formToken || null
                if (!formToken && !isParentTenant) {
                    emailFailures.push({ email: tenant.email, reason: 'No form token generated' })
                    continue
                }

                createdReferences.push(targetRef || { id: parentRefId })

                // Send V2 tenant reference email
                const tenantEmail = tenant.email?.trim()
                if (!tenantEmail) {
                    emailFailures.push({ email: '', reason: 'Missing tenant email' })
                    continue
                }

                const isGuarantor = false
                const formPath = isGuarantor ? 'guarantor-reference-v2' : 'submit-reference-v2'
                const formUrl = `${v2FrontendUrl}/${formPath}/${formToken}`

                try {
                    await sendV2TenantEmail(
                        tenantEmail,
                        `${tenant.first_name} ${tenant.last_name}`.trim(),
                        formUrl,
                        companyName,
                        propertyAddress || undefined,
                        companyPhone || undefined,
                        companyEmail || undefined,
                        (targetRef?.id || parentRefId) as string,
                        companyLogoUrl
                    )
                    emailsSent++
                } catch (emailError: any) {
                    console.error('Failed to send V2 reference email:', emailError)
                    emailFailures.push({ email: tenantEmail, reason: emailError.message })
                }
            }

            // Deduct credit
            try {
                const { deductCredits } = await import('../services/creditService')
                await deductCredits(companyId, 1, referenceId, 'reference', `V2 Reference for offer ${id}`)
            } catch (creditError: any) {
                console.error('Failed to deduct credit:', creditError)
            }

            // Update offer with reference ID
            await supabase
                .from('tenant_offers')
                .update({ reference_id: referenceId })
                .eq('id', id)

            return res.json({
                success: true,
                message: 'Holding deposit marked as received and V2 references created',
                reference_id: referenceId,
                references_created: createdReferences.length,
                holding_deposit_amount_paid: parsedAmount,
                emails_sent: emailsSent,
                email_failures: emailFailures,
                is_v2: true
            })
        }

        // ============================================================
        // V1 REFERENCE CREATION (legacy flow)
        // ============================================================
        if (tenants.length > 1) {
            // Multi-tenant flow
            const parentToken = generateToken()
            const parentTokenHash = hash(parentToken)

            // Create parent reference
            const { data: parentReference, error: parentError } = await supabase
                .from('tenant_references')
                .insert({
                    company_id: companyId,
                    created_by: userId,
                    tenant_first_name_encrypted: encrypt(tenants[0].first_name),
                    tenant_last_name_encrypted: encrypt(tenants[0].last_name),
                    tenant_email_encrypted: encrypt(tenants[0].email),
                    tenant_phone_encrypted: encrypt(tenants[0].phone),
                    property_address_encrypted: encrypt(propertyAddress),
                    property_city_encrypted: encrypt(propertyCity || ''),
                    property_postcode_encrypted: encrypt(propertyPostcode || ''),
                    monthly_rent: offer.offered_rent_amount,
                    move_in_date: offer.proposed_move_in_date,
                    term_years: termYears,
                    term_months: remainingMonths,
                    notes_encrypted: encrypt(offer.special_conditions_encrypted ? decrypt(offer.special_conditions_encrypted) : ''),
                    bills_included: offer.bills_included || false,
                    reference_token_hash: parentTokenHash,
                    token_expires_at: expiresAt.toISOString(),
                    status: 'pending',
                    is_group_parent: true,
                    linked_property_id: offer.linked_property_id || null
                })
                .select()
                .single()

            if (parentError) {
                return res.status(400).json({ error: parentError.message })
            }

            referenceId = parentReference.id

            // Create child references for each tenant
            for (let i = 0; i < tenants.length; i++) {
                const tenant = tenants[i]
                const token = generateToken()
                const tokenHash = hash(token)

                const { data: childReference, error: childError } = await supabase
                    .from('tenant_references')
                    .insert({
                        company_id: companyId,
                        created_by: userId,
                        parent_reference_id: parentReference.id,
                        tenant_position: i + 1,
                        tenant_first_name_encrypted: encrypt(tenant.first_name),
                        tenant_last_name_encrypted: encrypt(tenant.last_name),
                        tenant_email_encrypted: encrypt(tenant.email),
                        tenant_phone_encrypted: encrypt(tenant.phone),
                        property_address_encrypted: encrypt(propertyAddress),
                        property_city_encrypted: encrypt(propertyCity || ''),
                        property_postcode_encrypted: encrypt(propertyPostcode || ''),
                        monthly_rent: offer.offered_rent_amount,
                        rent_share: tenant.rent_share,
                        move_in_date: offer.proposed_move_in_date,
                        term_years: termYears,
                        term_months: remainingMonths,
                        notes_encrypted: encrypt(offer.special_conditions_encrypted ? decrypt(offer.special_conditions_encrypted) : ''),
                        bills_included: offer.bills_included || false,
                        reference_token_hash: tokenHash,
                        token_expires_at: expiresAt.toISOString(),
                        status: 'pending',
                        linked_property_id: offer.linked_property_id || null
                    })
                    .select()
                    .single()

                if (childError) {
                    console.error('Error creating child reference:', childError)
                    continue
                }

                createdReferences.push(childReference)

                // Send email to tenant
                const tenantUrl = `${frontendUrl}/submit-reference/${childReference.id}`
                const tenantEmail = tenant.email?.trim()
                if (!tenantEmail) {
                    emailFailures.push({ email: '', reason: 'Missing tenant email' })
                } else {
                    try {
                        await sendTenantReferenceWithRetry({
                            tenantEmail,
                            tenantName: `${tenant.first_name} ${tenant.last_name}`.trim(),
                            tenantUrl,
                            companyName,
                            propertyAddress: propertyAddress || undefined,
                            companyPhone: companyPhone || undefined,
                            companyEmail: companyEmail || undefined,
                            referenceId: childReference.id,
                            companyLogoUrl
                        })
                        emailsSent += 1
                    } catch (emailError: any) {
                        console.error('Failed to send email to', tenantEmail, emailError)
                        emailFailures.push({ email: tenantEmail, reason: emailError?.message || 'Send failed' })
                    }
                }
            }

            // Audit log
            await auditReferenceAction(
                companyId,
                userId!,
                parentReference.id,
                'reference.created',
                `Created multi-tenant reference from offer for ${tenants.length} tenants at ${propertyAddress}`,
                req,
                {
                    tenant_count: tenants.length,
                    property_address: propertyAddress,
                    monthly_rent: offer.offered_rent_amount,
                    source: 'tenant_offer'
                }
            )

            // Deduct credit
            try {
                await billingService.consumeCreditForReference(
                    companyId,
                    parentReference.id,
                    userId
                )
            } catch (creditError: any) {
                console.error('Failed to deduct credit:', creditError)
            }
        } else {
            // Single tenant flow
            const tenant = tenants[0]
            const token = generateToken()
            const tokenHash = hash(token)

            const { data: reference, error: refError } = await supabase
                .from('tenant_references')
                .insert({
                    company_id: companyId,
                    created_by: userId,
                    tenant_first_name_encrypted: encrypt(tenant.first_name),
                    tenant_last_name_encrypted: encrypt(tenant.last_name),
                    tenant_email_encrypted: encrypt(tenant.email),
                    tenant_phone_encrypted: encrypt(tenant.phone),
                    property_address_encrypted: encrypt(propertyAddress),
                    property_city_encrypted: encrypt(propertyCity || ''),
                    property_postcode_encrypted: encrypt(propertyPostcode || ''),
                    monthly_rent: offer.offered_rent_amount,
                    move_in_date: offer.proposed_move_in_date,
                    term_years: termYears,
                    term_months: remainingMonths,
                    notes_encrypted: encrypt(offer.special_conditions_encrypted ? decrypt(offer.special_conditions_encrypted) : ''),
                    bills_included: offer.bills_included || false,
                    reference_token_hash: tokenHash,
                    token_expires_at: expiresAt.toISOString(),
                    status: 'pending',
                    linked_property_id: offer.linked_property_id || null
                })
                .select()
                .single()

            if (refError) {
                return res.status(400).json({ error: refError.message })
            }

            referenceId = reference.id
            createdReferences.push(reference)

            // Send email to tenant
            const tenantUrl = `${frontendUrl}/submit-reference/${reference.id}`
            const tenantEmail = tenant.email?.trim()
            if (!tenantEmail) {
                emailFailures.push({ email: '', reason: 'Missing tenant email' })
            } else {
                try {
                    await sendTenantReferenceWithRetry({
                        tenantEmail,
                        tenantName: `${tenant.first_name} ${tenant.last_name}`.trim(),
                        tenantUrl,
                        companyName,
                        propertyAddress: propertyAddress || undefined,
                        companyPhone: companyPhone || undefined,
                        companyEmail: companyEmail || undefined,
                        referenceId: reference.id,
                        companyLogoUrl
                    })
                    emailsSent += 1
                } catch (emailError: any) {
                    console.error('Failed to send email to', tenantEmail, emailError)
                    emailFailures.push({ email: tenantEmail, reason: emailError?.message || 'Send failed' })
                }
            }

            // Audit log
            await auditReferenceAction(
                companyId,
                userId!,
                reference.id,
                'reference.created',
                `Created reference from offer for ${tenant.first_name} ${tenant.last_name} at ${propertyAddress}`,
                req,
                {
                    property_address: propertyAddress,
                    monthly_rent: offer.offered_rent_amount,
                    source: 'tenant_offer'
                }
            )

            // Deduct credit
            try {
                await billingService.consumeCreditForReference(
                    companyId,
                    reference.id,
                    userId
                )
            } catch (creditError: any) {
                console.error('Failed to deduct credit:', creditError)
            }
        }

        // Update offer with reference ID
        await supabase
            .from('tenant_offers')
            .update({
                reference_id: referenceId
            })
            .eq('id', id)

        // Update Apex27 listing status to "Let Agreed" if connected
        try {
            const { getCompanyApex27Config, updateListingStatus, apex27Fetch } = await import('../services/apex27Service')
            const config = await getCompanyApex27Config(companyId)
            if (config?.apiKey) {
                const propertyId = offer.linked_property_id
                let listingId: string | null = null

                if (propertyId) {
                    // Check if property has direct apex27_listing_id
                    const { data: prop } = await supabase
                        .from('properties')
                        .select('apex27_listing_id, postcode, address_line1_encrypted')
                        .eq('id', propertyId)
                        .single()

                    if (prop?.apex27_listing_id) {
                        listingId = prop.apex27_listing_id
                        console.log(`[HoldingDeposit→Apex27] Using linked listing ${listingId}`)
                    } else if (prop?.postcode) {
                        // Backup search: find listing by postcode + address with branch filter
                        const address = prop.address_line1_encrypted ? decrypt(prop.address_line1_encrypted) : null
                        const normAddr = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
                        const targetAddr = normAddr(address || '')
                        const targetPostcode = prop.postcode.toLowerCase().replace(/\s/g, '')

                        // Search params — include branch and don't filter by transactionType
                        // (listings may be in any status, we want to find them regardless)
                        const searchParams: Record<string, any> = {
                            postalCode: prop.postcode,
                            pageSize: 100
                        }
                        if (config.branchId) searchParams.branchId = config.branchId

                        console.log(`[HoldingDeposit→Apex27] Backup search: postcode=${prop.postcode}, branch=${config.branchId}, addr=${address}`)

                        const searchResult = await apex27Fetch<any[]>(config.apiKey, '/listings', searchParams)
                        const listings = (searchResult.success && Array.isArray(searchResult.data)) ? searchResult.data : []

                        if (listings.length > 0) {
                            // Try exact address match first
                            let match = targetAddr
                                ? listings.find((l: any) => l.address1 && normAddr(l.address1) === targetAddr)
                                : null

                            // Try partial address match (line1 contains target or vice versa)
                            if (!match && targetAddr) {
                                match = listings.find((l: any) => {
                                    const la = normAddr(l.address1 || '')
                                    return la && (la.includes(targetAddr) || targetAddr.includes(la))
                                })
                            }

                            // Try postcode-only match if there's exactly one listing for this postcode
                            if (!match) {
                                const samePostcode = listings.filter((l: any) =>
                                    (l.postalCode || '').toLowerCase().replace(/\s/g, '') === targetPostcode
                                )
                                if (samePostcode.length === 1) match = samePostcode[0]
                            }

                            if (match) {
                                listingId = String(match.id)
                                console.log(`[HoldingDeposit→Apex27] Backup search matched listing ${listingId} (${match.address1})`)
                                // Self-heal: persist the match for future
                                await supabase
                                    .from('properties')
                                    .update({ apex27_listing_id: listingId })
                                    .eq('id', propertyId)
                            } else {
                                console.log(`[HoldingDeposit→Apex27] Backup search returned ${listings.length} listings but none matched address "${address}"`)
                            }
                        } else {
                            console.log(`[HoldingDeposit→Apex27] Backup search returned 0 listings for postcode ${prop.postcode}`)
                        }
                    }
                }

                if (listingId) {
                    const updateResult = await updateListingStatus(config.apiKey, listingId, 'Let Agreed')
                    if (!updateResult.success) {
                        console.error(`[HoldingDeposit→Apex27] Status update failed: ${updateResult.error}`)
                    }
                } else {
                    console.log(`[HoldingDeposit→Apex27] No listing ID resolved for offer ${id} — status not updated`)
                }
            }
        } catch (apex27Error: any) {
            console.error('[HoldingDeposit] Apex27 status update failed (non-blocking):', apex27Error.message)
        }

        res.json({
            success: true,
            message: 'Holding deposit marked as received and references created',
            reference_id: referenceId,
            references_created: createdReferences.length,
            holding_deposit_amount_paid: parsedAmount,
            emails_sent: emailsSent,
            email_failures: emailFailures
        })
    } catch (error: any) {
        console.error('Error marking holding deposit received:', error)
        res.status(500).json({ error: error.message })
    }
})

// Resend approval or decline email
router.post('/:id/resend-email', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const userId = req.user?.id
        const { id } = req.params
        const { email_type } = req.body // 'approval' or 'decline'

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' })
        }

        if (!email_type || !['approval', 'decline'].includes(email_type)) {
            return res.status(400).json({ error: 'Valid email_type (approval or decline) is required' })
        }

        // Get company from X-Branch-Id header or user's company
        const companyId = await getCompanyIdForRequest(req)
        if (!companyId) {
            return res.status(404).json({ error: 'Company not found' })
        }

        // Get offer with tenants and company details
        const { data: offer, error: offerError } = await supabase
            .from('tenant_offers')
            .select(`
                *,
                tenant_offer_tenants (*),
                companies:company_id (
                    name_encrypted,
                    phone_encrypted,
                    email_encrypted,
                    bank_account_name,
                    bank_account_number,
                    bank_sort_code,
                    logo_url
                )
            `)
            .eq('id', id)
            .eq('company_id', companyId)
            .single()

        if (offerError || !offer) {
            return res.status(404).json({ error: 'Offer not found' })
        }

        // Validate offer status matches email type
        if (email_type === 'approval' && offer.status !== 'approved') {
            return res.status(400).json({ error: 'Cannot resend approval email - offer is not approved' })
        }

        if (email_type === 'decline' && offer.status !== 'declined') {
            return res.status(400).json({ error: 'Cannot resend decline email - offer is not declined' })
        }

        // Get company details
        const company = (offer as any).companies
        const companyName = company?.name_encrypted ? (decrypt(company.name_encrypted) || 'PropertyGoose') : 'PropertyGoose'
        const companyPhone = company?.phone_encrypted ? (decrypt(company.phone_encrypted) || '') : ''
        const companyEmail = company?.email_encrypted ? (decrypt(company.email_encrypted) || '') : ''
        const companyLogoUrl = company?.logo_url || null

        // Get tenant emails
        const tenantEmails = (offer.tenant_offer_tenants || []).map((tenant: any) =>
            tenant.email_encrypted ? decrypt(tenant.email_encrypted) : ''
        ).filter(Boolean)

        if (tenantEmails.length === 0) {
            return res.status(400).json({ error: 'No tenant emails found' })
        }

        if (email_type === 'approval') {
            const bankAccountName = company?.bank_account_name || ''
            const bankAccountNumber = company?.bank_account_number || ''
            const bankSortCode = company?.bank_sort_code || ''
            const holdingDeposit = Math.floor((offer.offered_rent_amount * 12) / 52)

            // Send approval email to all tenants
            for (const email of tenantEmails) {
                try {
                    await sendOfferAcceptedEmail(
                        email,
                        companyName,
                        bankAccountName,
                        bankAccountNumber,
                        bankSortCode,
                        holdingDeposit,
                        id,
                        companyPhone || undefined,
                        companyEmail || undefined,
                        undefined,
                        companyLogoUrl
                    )
                } catch (emailError) {
                    console.error(`Failed to resend approval email to ${email}:`, emailError)
                }
            }

            // Log audit action
            await logOfferAuditAction({
                offerId: id,
                action: 'APPROVAL_EMAIL_RESENT',
                description: `Approval email resent to ${tenantEmails.length} tenant(s)`,
                metadata: { recipients: tenantEmails },
                userId
            })
        } else {
            // Get decline reason
            const declineReason = offer.declined_reason_encrypted ? (decrypt(offer.declined_reason_encrypted) || 'Your offer was not accepted.') : 'Your offer was not accepted.'

            // Send decline email to all tenants
            for (const email of tenantEmails) {
                try {
                    await sendOfferDeclinedEmail(
                        email,
                        companyName,
                        declineReason,
                        companyPhone || undefined,
                        companyEmail || undefined,
                        companyLogoUrl
                    )
                } catch (emailError) {
                    console.error(`Failed to resend decline email to ${email}:`, emailError)
                }
            }

            // Log audit action
            await logOfferAuditAction({
                offerId: id,
                action: 'DECLINE_EMAIL_RESENT',
                description: `Decline email resent to ${tenantEmails.length} tenant(s)`,
                metadata: { recipients: tenantEmails },
                userId
            })
        }

        res.json({
            success: true,
            message: `${email_type === 'approval' ? 'Approval' : 'Decline'} email resent to ${tenantEmails.length} tenant(s)`
        })
    } catch (error: any) {
        console.error('Error resending email:', error)
        res.status(500).json({ error: error.message })
    }
})

export default router
