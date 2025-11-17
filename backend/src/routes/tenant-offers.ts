import { Router } from 'express'
import { authenticateToken, AuthRequest } from '../middleware/auth'
import { supabase } from '../config/supabase'
import { encrypt, decrypt, generateToken, hash } from '../services/encryption'
import { sendEmail, sendTenantReferenceRequest, sendTenantOfferRequest, sendOfferAcceptedEmail, sendOfferDeclinedEmail } from '../services/emailService'
import { checkCredits } from '../middleware/checkCredits'
import { checkPaymentMethod } from '../middleware/checkPaymentMethod'
import * as billingService from '../services/billingService'
import { auditReferenceAction } from '../services/auditLog'

const router = Router()

// Send offer form link via email
router.post('/send-link', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const userId = req.user?.id
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' })
        }

        const {
            tenant_email,
            property_address
        } = req.body

        // Validate required fields
        if (!tenant_email || !property_address) {
            return res.status(400).json({ error: 'Tenant email and property address are required' })
        }

        // Get user's company
        const { data: companyUsers } = await supabase
            .from('company_users')
            .select('company_id, companies:company_id(name_encrypted, phone_encrypted, email_encrypted)')
            .eq('user_id', userId)
            .limit(1)

        if (!companyUsers || companyUsers.length === 0) {
            return res.status(404).json({ error: 'Company not found' })
        }

        const companyUser = companyUsers[0]
        const companyName = (companyUser as any).companies?.name_encrypted
            ? (decrypt((companyUser as any).companies.name_encrypted) || 'Your agent')
            : 'Your agent'
        const companyPhone = (companyUser as any).companies?.phone_encrypted
            ? (decrypt((companyUser as any).companies.phone_encrypted) || '')
            : ''

        // Generate offer form link with company ID
        const offerLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/tenant-offer?company_id=${companyUser.company_id}`

        // Send email to tenant with offer form link
        try {
            await sendTenantOfferRequest(
                tenant_email,
                offerLink,
                companyName,
                property_address,
                companyPhone || undefined
            )
            console.log('Offer form email sent successfully to:', tenant_email)
        } catch (emailError: any) {
            console.error('Failed to send offer form email:', emailError)
            // Don't fail the request if email fails, just log it
        }

        res.status(200).json({
            success: true,
            message: 'Offer form link sent successfully',
            email: tenant_email
        })
    } catch (error: any) {
        console.error('Error sending offer form link:', error)
        res.status(500).json({ error: error.message })
    }
})

// Get all offers for company
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const userId = req.user?.id
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' })
        }

        // Get user's company
        const { data: companyUsers } = await supabase
            .from('company_users')
            .select('company_id')
            .eq('user_id', userId)
            .limit(1)

        if (!companyUsers || companyUsers.length === 0) {
            return res.status(404).json({ error: 'Company not found' })
        }

        const companyId = companyUsers[0].company_id

        // Get all offers for the company with tenants
        const { data: offers, error } = await supabase
            .from('tenant_offers')
            .select(`
        *,
        tenant_offer_tenants (
          id,
          tenant_order,
          name_encrypted,
          address_encrypted,
          phone_encrypted,
          email_encrypted,
          annual_income_encrypted,
          no_ccj_bankruptcy_iva,
          signature_encrypted,
          signature_name_encrypted,
          signed_at
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
                address: tenant.address_encrypted ? decrypt(tenant.address_encrypted) : '',
                phone: tenant.phone_encrypted ? decrypt(tenant.phone_encrypted) : '',
                email: tenant.email_encrypted ? decrypt(tenant.email_encrypted) : '',
                annual_income: tenant.annual_income_encrypted ? decrypt(tenant.annual_income_encrypted) : '',
                job_title: tenant.job_title_encrypted ? decrypt(tenant.job_title_encrypted) : '',
                no_ccj_bankruptcy_iva: tenant.no_ccj_bankruptcy_iva,
                signature: tenant.signature_encrypted ? decrypt(tenant.signature_encrypted) : '',
                signature_name: tenant.signature_name_encrypted ? decrypt(tenant.signature_name_encrypted) : '',
                signed_at: tenant.signed_at
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

// Get single offer by ID
router.get('/:id', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const userId = req.user?.id
        const { id } = req.params

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' })
        }

        // Get user's company
        const { data: companyUsers } = await supabase
            .from('company_users')
            .select('company_id')
            .eq('user_id', userId)
            .limit(1)

        if (!companyUsers || companyUsers.length === 0) {
            return res.status(404).json({ error: 'Company not found' })
        }

        const companyId = companyUsers[0].company_id

        // Get offer with tenants
        const { data: offer, error } = await supabase
            .from('tenant_offers')
            .select(`
        *,
        tenant_offer_tenants (
          id,
          tenant_order,
          name_encrypted,
          address_encrypted,
          phone_encrypted,
          email_encrypted,
          annual_income_encrypted,
          no_ccj_bankruptcy_iva,
          signature_encrypted,
          signature_name_encrypted,
          signed_at
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
            phone: tenant.phone_encrypted ? decrypt(tenant.phone_encrypted) : '',
            email: tenant.email_encrypted ? decrypt(tenant.email_encrypted) : '',
            annual_income: tenant.annual_income_encrypted ? decrypt(tenant.annual_income_encrypted) : '',
            no_ccj_bankruptcy_iva: tenant.no_ccj_bankruptcy_iva,
            signature: tenant.signature_encrypted ? decrypt(tenant.signature_encrypted) : '',
            signature_name: tenant.signature_name_encrypted ? decrypt(tenant.signature_name_encrypted) : '',
            signed_at: tenant.signed_at
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

// Check if tenant has already submitted an offer (public route - no auth required)
router.get('/check-submission', async (req, res) => {
    try {
        const { email, company_id } = req.query

        if (!email || !company_id) {
            return res.status(400).json({ error: 'Email and company_id are required' })
        }

        // Get all offers for the company
        const { data: offers, error: offersError } = await supabase
            .from('tenant_offers')
            .select('id, status, created_at')
            .eq('company_id', company_id as string)
            .order('created_at', { ascending: false })

        if (offersError) {
            return res.status(500).json({ error: 'Failed to check offers' })
        }

        if (!offers || offers.length === 0) {
            return res.status(200).json({ submitted: false })
        }

        // Check if any tenant in any offer has this email
        const offerIds = offers.map(offer => offer.id)
        const { data: tenants, error: tenantsError } = await supabase
            .from('tenant_offer_tenants')
            .select('id, email_encrypted, tenant_offer_id, tenant_offers:tenant_offer_id(status, created_at)')
            .in('tenant_offer_id', offerIds)

        if (tenantsError) {
            return res.status(500).json({ error: 'Failed to check tenants' })
        }

        // Decrypt and check emails
        let foundSubmission = null
        const emailToCheck = (email as string).toLowerCase()

        for (const tenant of tenants || []) {
            try {
                if (tenant.email_encrypted) {
                    const decryptedEmail = decrypt(tenant.email_encrypted)
                    if (decryptedEmail?.toLowerCase() === emailToCheck) {
                        foundSubmission = {
                            status: (tenant.tenant_offers as any)?.status || 'pending',
                            created_at: (tenant.tenant_offers as any)?.created_at
                        }
                        break
                    }
                }
            } catch (err) {
                // Continue checking other tenants
                continue
            }
        }

        if (foundSubmission) {
            return res.status(200).json({
                submitted: true,
                status: foundSubmission.status,
                created_at: foundSubmission.created_at
            })
        }

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
            tenants // Array of tenant objects
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
            if (!tenant.name || !tenant.address || !tenant.phone || !tenant.email || !tenant.annual_income) {
                return res.status(400).json({ error: `Tenant ${i + 1} is missing required fields` })
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
            .select('id, name_encrypted, offer_notification_email')
            .eq('id', companyId)
            .single()

        if (companyError || !companyData) {
            return res.status(404).json({ error: 'Company not found' })
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
                deposit_amount: deposit_amount ? parseFloat(deposit_amount) : null,
                special_conditions_encrypted: special_conditions ? encrypt(special_conditions) : null,
                status: 'pending'
            })
            .select()
            .single()

        if (offerError || !offer) {
            return res.status(400).json({ error: offerError?.message || 'Failed to create offer' })
        }

        // Create tenant records
        const tenantRecords = tenants.map((tenant: any, index: number) => ({
            tenant_offer_id: offer.id,
            tenant_order: index + 1,
            name_encrypted: encrypt(tenant.name),
            address_encrypted: encrypt(tenant.address),
            phone_encrypted: encrypt(tenant.phone),
            email_encrypted: encrypt(tenant.email),
            annual_income_encrypted: encrypt(tenant.annual_income),
            job_title_encrypted: tenant.job_title ? encrypt(tenant.job_title) : null,
            no_ccj_bankruptcy_iva: tenant.no_ccj_bankruptcy_iva === true,
            signature_encrypted: tenant.signature ? encrypt(tenant.signature) : null,
            signature_name_encrypted: tenant.signature_name ? encrypt(tenant.signature_name) : null,
            signed_at: tenant.signature ? new Date().toISOString() : null
        }))

        const { error: tenantsError } = await supabase
            .from('tenant_offer_tenants')
            .insert(tenantRecords)

        if (tenantsError) {
            // Rollback offer creation
            await supabase.from('tenant_offers').delete().eq('id', offer.id)
            return res.status(400).json({ error: tenantsError.message })
        }

        // Get company details for email notification (already fetched above)
        const companyName = companyData?.name_encrypted ? decrypt(companyData.name_encrypted) : 'PropertyGoose'
        const notificationEmail = companyData?.offer_notification_email || (companyData?.name_encrypted ? decrypt(companyData.name_encrypted) : null)

        // Send notification email to agent
        if (notificationEmail) {
            try {
                const tenantNames = tenants.map((t: any) => t.name).join(', ')
                const propertyAddress = property_address

                const emailHtml = `
          <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
              <h2>New Tenant Offer Received</h2>
              <p>A new tenant offer has been submitted for your review.</p>
              <h3>Offer Details:</h3>
              <ul>
                <li><strong>Property:</strong> ${propertyAddress}</li>
                <li><strong>Tenants:</strong> ${tenantNames}</li>
                <li><strong>Offered Rent:</strong> £${offered_rent_amount} per month</li>
                <li><strong>Proposed Move-in Date:</strong> ${proposed_move_in_date}</li>
                <li><strong>Tenancy Length:</strong> ${proposed_tenancy_length_months} months</li>
              </ul>
              <p><a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/tenant-offers/${offer.id}" style="background-color: #FF8C41; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Offer</a></p>
            </body>
          </html>
        `

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

// Approve offer
router.post('/:id/approve', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const userId = req.user?.id
        const { id } = req.params

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' })
        }

        // Get user's company
        const { data: companyUsers } = await supabase
            .from('company_users')
            .select('company_id')
            .eq('user_id', userId)
            .limit(1)

        if (!companyUsers || companyUsers.length === 0) {
            return res.status(404).json({ error: 'Company not found' })
        }

        const companyId = companyUsers[0].company_id

        // Get offer
        const { data: offer, error: offerError } = await supabase
            .from('tenant_offers')
            .select(`
        *,
        tenant_offer_tenants (*),
        companies:company_id (
          name_encrypted,
          bank_account_name,
          bank_account_number,
          bank_sort_code
        )
      `)
            .eq('id', id)
            .eq('company_id', companyId)
            .single()

        if (offerError || !offer) {
            return res.status(404).json({ error: 'Offer not found' })
        }

        if (offer.status !== 'pending' && offer.status !== 'accepted_with_changes') {
            return res.status(400).json({ error: 'Offer cannot be approved in its current status' })
        }

        // Update offer status
        const { error: updateError } = await supabase
            .from('tenant_offers')
            .update({
                status: 'approved',
                approved_at: new Date().toISOString(),
                approved_by: userId
            })
            .eq('id', id)

        if (updateError) {
            return res.status(400).json({ error: updateError.message })
        }

        // Get company details
        const company = (offer as any).companies
        const companyName = company?.name_encrypted ? (decrypt(company.name_encrypted) || 'PropertyGoose') : 'PropertyGoose'
        const bankAccountName = company?.bank_account_name || ''
        const bankAccountNumber = company?.bank_account_number || ''
        const bankSortCode = company?.bank_sort_code || ''

        // Calculate holding deposit (one week's rent)
        const holdingDeposit = (offer.offered_rent_amount * 12) / 52

        // Get tenant emails
        const tenantEmails = (offer.tenant_offer_tenants || []).map((tenant: any) =>
            tenant.email_encrypted ? decrypt(tenant.email_encrypted) : ''
        ).filter(Boolean)

        // Send approval email with bank details to all tenants
        for (const email of tenantEmails) {
            try {
                await sendOfferAcceptedEmail(
                    email,
                    companyName,
                    bankAccountName,
                    bankAccountNumber,
                    bankSortCode,
                    holdingDeposit
                )
            } catch (emailError) {
                console.error(`Failed to send approval email to ${email}:`, emailError)
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

        // Get user's company
        const { data: companyUsers } = await supabase
            .from('company_users')
            .select('company_id')
            .eq('user_id', userId)
            .limit(1)

        if (!companyUsers || companyUsers.length === 0) {
            return res.status(404).json({ error: 'Company not found' })
        }

        const companyId = companyUsers[0].company_id

        // Get offer
        const { data: offer, error: offerError } = await supabase
            .from('tenant_offers')
            .select(`
        *,
        tenant_offer_tenants (*),
        companies:company_id (name_encrypted)
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
                    reason
                )
            } catch (emailError) {
                console.error(`Failed to send decline email to ${email}:`, emailError)
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

        // Get user's company
        const { data: companyUsers } = await supabase
            .from('company_users')
            .select('company_id')
            .eq('user_id', userId)
            .limit(1)

        if (!companyUsers || companyUsers.length === 0) {
            return res.status(404).json({ error: 'Company not found' })
        }

        const companyId = companyUsers[0].company_id

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
            const tenantRecords = tenants.map((tenant: any, index: number) => ({
                tenant_offer_id: id,
                tenant_order: index + 1,
                name_encrypted: encrypt(tenant.name),
                address_encrypted: encrypt(tenant.address),
                phone_encrypted: encrypt(tenant.phone),
                email_encrypted: encrypt(tenant.email),
                annual_income_encrypted: encrypt(tenant.annual_income),
                job_title_encrypted: tenant.job_title ? encrypt(tenant.job_title) : null,
                no_ccj_bankruptcy_iva: tenant.no_ccj_bankruptcy_iva === true,
                signature_encrypted: tenant.signature ? encrypt(tenant.signature) : null,
                signature_name_encrypted: tenant.signature_name ? encrypt(tenant.signature_name) : null,
                signed_at: tenant.signature ? new Date().toISOString() : null
            }))

            const { error: tenantsError } = await supabase
                .from('tenant_offer_tenants')
                .insert(tenantRecords)

            if (tenantsError) {
                return res.status(400).json({ error: tenantsError.message })
            }
        }

        res.json({
            success: true,
            message: 'Offer updated successfully'
        })
    } catch (error: any) {
        console.error('Error updating offer:', error)
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

        // Get offer with company details and tenants
        const { data: offerData, error: offerFetchError } = await supabase
            .from('tenant_offers')
            .select(`
                *,
                tenant_offer_tenants (*),
                companies:company_id (
                    id,
                    name_encrypted,
                    phone_encrypted,
                    email_encrypted
                )
            `)
            .eq('id', id)
            .single()

        if (offerFetchError || !offerData) {
            return res.status(404).json({ error: 'Offer not found' })
        }

        const company = (offerData as any).companies
        if (!company || !company.id) {
            return res.status(404).json({ error: 'Company not found for this offer' })
        }

        const companyId = company.id
        const companyName = company?.name_encrypted
            ? (decrypt(company.name_encrypted) || 'Your agent')
            : 'Your agent'
        const companyPhone = company?.phone_encrypted
            ? (decrypt(company.phone_encrypted) || '')
            : ''
        const companyEmail = company?.email_encrypted
            ? (decrypt(company.email_encrypted) || '')
            : ''

        // Verify user has access to this company
        const { data: companyUsers } = await supabase
            .from('company_users')
            .select('company_id')
            .eq('user_id', userId)
            .eq('company_id', companyId)
            .limit(1)

        if (!companyUsers || companyUsers.length === 0) {
            return res.status(403).json({ error: 'You do not have access to this company' })
        }

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
                status: 'approved'
            })
            .eq('id', id)

        if (updateError) {
            return res.status(400).json({ error: updateError.message })
        }

        // Use the offer data we already fetched
        const offer = offerData

        // Get tenants from offer
        const tenants = (offer.tenant_offer_tenants || []).map((tenant: any) => {
            const decryptedName = tenant.name_encrypted ? decrypt(tenant.name_encrypted) : ''
            const nameParts = decryptedName ? decryptedName.split(' ') : ['']
            return {
                first_name: nameParts[0] || '',
                last_name: nameParts.slice(1).join(' ') || '',
                email: tenant.email_encrypted ? decrypt(tenant.email_encrypted) : '',
                phone: tenant.phone_encrypted ? decrypt(tenant.phone_encrypted) : '',
                address: tenant.address_encrypted ? decrypt(tenant.address_encrypted) : '',
                annual_income: tenant.annual_income_encrypted ? decrypt(tenant.annual_income_encrypted) : '',
                job_title: tenant.job_title_encrypted ? decrypt(tenant.job_title_encrypted) : '',
                rent_share: (offer.offered_rent_amount / (offer.tenant_offer_tenants?.length || 1)).toFixed(2)
            }
        })

        const propertyAddress = offer.property_address_encrypted ? decrypt(offer.property_address_encrypted) : ''
        const propertyCity = offer.property_city_encrypted ? decrypt(offer.property_city_encrypted) : ''
        const propertyPostcode = offer.property_postcode_encrypted ? decrypt(offer.property_postcode_encrypted) : ''

        // Calculate term years and months from proposed_tenancy_length_months
        const termMonths = offer.proposed_tenancy_length_months
        const termYears = Math.floor(termMonths / 12)
        const remainingMonths = termMonths % 12

        // Token expires in 30 days
        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + 30)

        let createdReferences: any[] = []
        let referenceId: string | null = null

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
                    reference_token_hash: parentTokenHash,
                    token_expires_at: expiresAt.toISOString(),
                    status: 'pending',
                    is_group_parent: true
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
                        reference_token_hash: tokenHash,
                        token_expires_at: expiresAt.toISOString(),
                        status: 'pending'
                    })
                    .select()
                    .single()

                if (childError) {
                    console.error('Error creating child reference:', childError)
                    continue
                }

                createdReferences.push(childReference)

                // Send email to tenant
                const tenantUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/submit-reference/${token}`
                try {
                    await sendTenantReferenceRequest(
                        tenant.email,
                        `${tenant.first_name} ${tenant.last_name}`,
                        tenantUrl,
                        companyName,
                        propertyAddress || undefined,
                        companyPhone || undefined
                    )
                } catch (emailError: any) {
                    console.error('Failed to send email to', tenant.email, emailError)
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
                    reference_token_hash: tokenHash,
                    token_expires_at: expiresAt.toISOString(),
                    status: 'pending'
                })
                .select()
                .single()

            if (refError) {
                return res.status(400).json({ error: refError.message })
            }

            referenceId = reference.id
            createdReferences.push(reference)

            // Send email to tenant
            const tenantUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/submit-reference/${token}`
            try {
                await sendTenantReferenceRequest(
                    tenant.email,
                    `${tenant.first_name} ${tenant.last_name}`,
                    tenantUrl,
                    companyName,
                    propertyAddress || undefined,
                    companyPhone || undefined
                )
            } catch (emailError: any) {
                console.error('Failed to send email to', tenant.email, emailError)
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

        res.json({
            success: true,
            message: 'Holding deposit marked as received and references created',
            reference_id: referenceId,
            references_created: createdReferences.length,
            holding_deposit_amount_paid: parsedAmount
        })
    } catch (error: any) {
        console.error('Error marking holding deposit received:', error)
        res.status(500).json({ error: error.message })
    }
})

export default router

