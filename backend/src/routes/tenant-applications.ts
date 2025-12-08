import { Router } from 'express'
import { authenticateToken, AuthRequest } from '../middleware/auth'
import { supabase } from '../config/supabase'
import { generateToken, hash, encrypt, decrypt } from '../services/encryption'
import { sendTenantApplicationRequest, sendApplicationCompletedNotification } from '../services/emailService'
import multer from 'multer'
import path from 'path'

const router = Router()

// Configure multer for file uploads (store in memory)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedMimes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true)
        } else {
            cb(new Error('Invalid file type. Only PDF and images are allowed.'))
        }
    }
})

// Get all applications for company
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

        // Get all applications for the company
        const { data: applications, error } = await supabase
            .from('tenant_applications')
            .select('*')
            .eq('company_id', companyId)
            .order('created_at', { ascending: false })

        if (error) {
            return res.status(400).json({ error: error.message })
        }

        // Decrypt email addresses for display
        const decryptedApplications = applications?.map(app => ({
            ...app,
            applicant_email: app.applicant_email_encrypted ? decrypt(app.applicant_email_encrypted) : '',
            property_address: app.property_address_encrypted ? decrypt(app.property_address_encrypted) : '',
            agent_email: app.agent_email_encrypted ? decrypt(app.agent_email_encrypted) : '',
        })) || []

        res.json({ applications: decryptedApplications })
    } catch (error: any) {
        console.error('Error fetching applications:', error)
        res.status(500).json({ error: error.message })
    }
})

// Get single application by ID (authenticated)
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

        // Get application
        const { data: application, error } = await supabase
            .from('tenant_applications')
            .select('*')
            .eq('id', id)
            .eq('company_id', companyId)
            .single()

        if (error) {
            return res.status(404).json({ error: 'Application not found' })
        }

        // Decrypt all encrypted fields
        const decrypted = {
            ...application,
            applicant_email: application.applicant_email_encrypted ? decrypt(application.applicant_email_encrypted) : '',
            property_address: application.property_address_encrypted ? decrypt(application.property_address_encrypted) : '',
            property_city: application.property_city_encrypted ? decrypt(application.property_city_encrypted) : '',
            property_postcode: application.property_postcode_encrypted ? decrypt(application.property_postcode_encrypted) : '',
            agent_email: application.agent_email_encrypted ? decrypt(application.agent_email_encrypted) : '',
            first_name: application.first_name_encrypted ? decrypt(application.first_name_encrypted) : '',
            middle_name: application.middle_name_encrypted ? decrypt(application.middle_name_encrypted) : '',
            last_name: application.last_name_encrypted ? decrypt(application.last_name_encrypted) : '',
            date_of_birth: application.date_of_birth_encrypted ? decrypt(application.date_of_birth_encrypted) : '',
            phone: application.phone_encrypted ? decrypt(application.phone_encrypted) : '',
            nationality: application.nationality_encrypted ? decrypt(application.nationality_encrypted) : '',
            current_address_line1: application.current_address_line1_encrypted ? decrypt(application.current_address_line1_encrypted) : '',
            current_address_line2: application.current_address_line2_encrypted ? decrypt(application.current_address_line2_encrypted) : '',
            current_city: application.current_city_encrypted ? decrypt(application.current_city_encrypted) : '',
            current_postcode: application.current_postcode_encrypted ? decrypt(application.current_postcode_encrypted) : '',
            current_country: application.current_country_encrypted ? decrypt(application.current_country_encrypted) : '',
            employer_name: application.employer_name_encrypted ? decrypt(application.employer_name_encrypted) : '',
            job_title: application.job_title_encrypted ? decrypt(application.job_title_encrypted) : '',
            annual_income: application.annual_income_encrypted ? decrypt(application.annual_income_encrypted) : '',
            business_name: application.business_name_encrypted ? decrypt(application.business_name_encrypted) : '',
            nature_of_business: application.nature_of_business_encrypted ? decrypt(application.nature_of_business_encrypted) : '',
            annual_turnover: application.annual_turnover_encrypted ? decrypt(application.annual_turnover_encrypted) : '',
            additional_income_amount: application.additional_income_amount_encrypted ? decrypt(application.additional_income_amount_encrypted) : '',
            previous_rental_address: application.previous_rental_address_encrypted ? decrypt(application.previous_rental_address_encrypted) : '',
            previous_landlord_name: application.previous_landlord_name_encrypted ? decrypt(application.previous_landlord_name_encrypted) : '',
            previous_landlord_email: application.previous_landlord_email_encrypted ? decrypt(application.previous_landlord_email_encrypted) : '',
            previous_landlord_phone: application.previous_landlord_phone_encrypted ? decrypt(application.previous_landlord_phone_encrypted) : '',
            previous_monthly_rent: application.previous_monthly_rent_encrypted ? decrypt(application.previous_monthly_rent_encrypted) : '',
            signature: application.signature_encrypted ? decrypt(application.signature_encrypted) : '',
            signature_name: application.signature_name_encrypted ? decrypt(application.signature_name_encrypted) : '',
            notes: application.notes_encrypted ? decrypt(application.notes_encrypted) : '',
        }

        res.json({ application: decrypted })
    } catch (error: any) {
        console.error('Error fetching application:', error)
        res.status(500).json({ error: error.message })
    }
})

// Resend application email
router.post('/:id/resend', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const userId = req.user?.id
        const { id } = req.params

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' })
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
        const companyId = companyUser.company_id

        // Get application
        const { data: application, error: fetchError } = await supabase
            .from('tenant_applications')
            .select('*')
            .eq('id', id)
            .eq('company_id', companyId)
            .single()

        if (fetchError || !application) {
            return res.status(404).json({ error: 'Application not found' })
        }

        // Check if already submitted
        if (application.status === 'submitted' || application.submitted_at) {
            return res.status(400).json({ error: 'Cannot resend - application has already been submitted' })
        }

        // Generate new token
        const token = generateToken()
        const tokenHash = hash(token)
        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + 21) // 21 days expiry

        // Update token in database
        const { error: updateError } = await supabase
            .from('tenant_applications')
            .update({
                application_token_hash: tokenHash,
                token_expires_at: expiresAt.toISOString()
            })
            .eq('id', id)

        if (updateError) {
            return res.status(400).json({ error: updateError.message })
        }

        // Get company details for email
        const companyName = (companyUser as any).companies?.name_encrypted
            ? (decrypt((companyUser as any).companies.name_encrypted) || 'Your agent')
            : 'Your agent'
        const companyPhone = (companyUser as any).companies?.phone_encrypted
            ? (decrypt((companyUser as any).companies.phone_encrypted) || '')
            : ''
        const companyEmail = (companyUser as any).companies?.email_encrypted
            ? (decrypt((companyUser as any).companies.email_encrypted) || '')
            : ''

        // Get applicant details
        const applicantEmail = application.applicant_email_encrypted
            ? decrypt(application.applicant_email_encrypted) || ''
            : ''
        const propertyAddress = application.property_address_encrypted
            ? decrypt(application.property_address_encrypted) || ''
            : ''

        if (!applicantEmail) {
            return res.status(400).json({ error: 'Applicant email not found' })
        }

        // Send email
        const applicationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/tenant-application/${token}`

        try {
            await sendTenantApplicationRequest(
                applicantEmail,
                applicationUrl,
                companyName,
                propertyAddress,
                companyPhone || undefined,
                companyEmail || undefined
            )
            console.log('Application email resent successfully to:', applicantEmail)
        } catch (emailError: any) {
            console.error('Failed to resend application email:', emailError)
            return res.status(500).json({ error: 'Failed to send email' })
        }

        res.json({
            success: true,
            message: 'Application email resent successfully',
            email: applicantEmail
        })
    } catch (error: any) {
        console.error('Error resending application:', error)
        res.status(500).json({ error: error.message })
    }
})

// Create new application request (only email and property address required)
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const userId = req.user?.id
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' })
        }

        const {
            applicant_email,
            property_address,
            property_city,
            property_postcode,
            agent_email
        } = req.body

        // Validate required fields
        if (!applicant_email || !property_address || !agent_email) {
            return res.status(400).json({ error: 'Applicant email, property address, and agent email are required' })
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
        const companyEmail = (companyUser as any).companies?.email_encrypted
            ? (decrypt((companyUser as any).companies.email_encrypted) || '')
            : ''

        // Generate token for application form
        const token = generateToken()
        const tokenHash = hash(token)
        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + 21) // 21 days expiry

        // Create application record
        const { data: application, error } = await supabase
            .from('tenant_applications')
            .insert({
                company_id: companyUser.company_id,
                created_by: userId,
                applicant_email_encrypted: encrypt(applicant_email),
                property_address_encrypted: encrypt(property_address),
                property_city_encrypted: encrypt(property_city || ''),
                property_postcode_encrypted: encrypt(property_postcode || ''),
                agent_email_encrypted: encrypt(agent_email),
                application_token_hash: tokenHash,
                token_expires_at: expiresAt.toISOString(),
                status: 'pending'
            })
            .select()
            .single()

        if (error) {
            return res.status(400).json({ error: error.message })
        }

        // Send email to tenant with application form link
        const applicationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/tenant-application/${token}`

        try {
            await sendTenantApplicationRequest(
                applicant_email,
                applicationUrl,
                companyName,
                property_address,
                companyPhone || undefined,
                companyEmail || undefined
            )
            console.log('Application email sent successfully to:', applicant_email)
        } catch (emailError: any) {
            console.error('Failed to send application email:', emailError)
            // Don't fail the request if email fails, just log it
        }

        res.status(201).json({
            application: {
                ...application,
                applicant_email,
                property_address,
                agent_email
            },
            token // Return token for testing (in production, only return in email)
        })
    } catch (error: any) {
        console.error('Error creating application:', error)
        res.status(500).json({ error: error.message })
    }
})

// Get application by token (public route for form access)
router.get('/token/:token', async (req, res) => {
    try {
        const { token } = req.params
        const tokenHash = hash(token)

        // Find application by token hash
        const { data: application, error } = await supabase
            .from('tenant_applications')
            .select('*')
            .eq('application_token_hash', tokenHash)
            .single()

        if (error || !application) {
            return res.status(404).json({ error: 'Application not found or invalid token' })
        }

        // Check if token has expired
        if (new Date(application.token_expires_at) < new Date()) {
            return res.status(400).json({ error: 'Application link has expired' })
        }

        // Check if already submitted
        if (application.status === 'submitted' || application.submitted_at) {
            return res.json({
                application: {
                    ...application,
                    applicant_email: application.applicant_email_encrypted ? decrypt(application.applicant_email_encrypted) : '',
                    property_address: application.property_address_encrypted ? decrypt(application.property_address_encrypted) : '',
                },
                alreadySubmitted: true
            })
        }

        // Return minimal data (email and property address for display)
        res.json({
            application: {
                id: application.id,
                applicant_email: application.applicant_email_encrypted ? decrypt(application.applicant_email_encrypted) : '',
                property_address: application.property_address_encrypted ? decrypt(application.property_address_encrypted) : '',
                property_city: application.property_city_encrypted ? decrypt(application.property_city_encrypted) : '',
                property_postcode: application.property_postcode_encrypted ? decrypt(application.property_postcode_encrypted) : '',
                status: application.status,
                created_at: application.created_at
            },
            alreadySubmitted: false
        })
    } catch (error: any) {
        console.error('Error fetching application by token:', error)
        res.status(500).json({ error: error.message })
    }
})

// Submit application form (public route)
router.post('/token/:token/submit', upload.single('id_document'), async (req, res) => {
    try {
        const { token } = req.params
        const tokenHash = hash(token)

        // Find application by token hash
        const { data: application, error: findError } = await supabase
            .from('tenant_applications')
            .select('*')
            .eq('application_token_hash', tokenHash)
            .single()

        if (findError || !application) {
            return res.status(404).json({ error: 'Application not found or invalid token' })
        }

        // Check if token has expired
        if (new Date(application.token_expires_at) < new Date()) {
            return res.status(400).json({ error: 'Application link has expired' })
        }

        // Check if already submitted
        if (application.status === 'submitted' || application.submitted_at) {
            return res.status(400).json({ error: 'Application has already been submitted' })
        }

        const formData = req.body

        // Handle file upload if provided
        let idDocumentPath = application.id_document_path || null
        if (req.file) {
            // Upload file to Supabase Storage
            const fileExt = path.extname(req.file.originalname)
            const fileName = `${application.id}_${Date.now()}${fileExt}`
            const filePath = `applications/${fileName}`

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('documents')
                .upload(filePath, req.file.buffer, {
                    contentType: req.file.mimetype,
                    upsert: false
                })

            if (uploadError) {
                console.error('Error uploading file:', uploadError)
                return res.status(500).json({ error: 'Failed to upload document' })
            }

            idDocumentPath = filePath
        }

        // Prepare update data
        const updateData: any = {
            status: 'submitted',
            submitted_at: new Date().toISOString(),
            first_name_encrypted: formData.first_name ? encrypt(formData.first_name) : null,
            middle_name_encrypted: formData.middle_name ? encrypt(formData.middle_name) : null,
            last_name_encrypted: formData.last_name ? encrypt(formData.last_name) : null,
            date_of_birth_encrypted: formData.date_of_birth ? encrypt(formData.date_of_birth) : null,
            phone_encrypted: formData.phone ? encrypt(formData.phone) : null,
            nationality_encrypted: formData.nationality ? encrypt(formData.nationality) : null,
            current_address_line1_encrypted: formData.current_address_line1 ? encrypt(formData.current_address_line1) : null,
            current_address_line2_encrypted: formData.current_address_line2 ? encrypt(formData.current_address_line2) : null,
            current_city_encrypted: formData.current_city ? encrypt(formData.current_city) : null,
            current_postcode_encrypted: formData.current_postcode ? encrypt(formData.current_postcode) : null,
            current_country_encrypted: formData.current_country ? encrypt(formData.current_country) : null,
            time_at_address_years: formData.time_at_address_years ? parseInt(formData.time_at_address_years) : null,
            time_at_address_months: formData.time_at_address_months ? parseInt(formData.time_at_address_months) : null,
            employment_status: formData.employment_status || null,
            employer_name_encrypted: formData.employer_name ? encrypt(formData.employer_name) : null,
            job_title_encrypted: formData.job_title ? encrypt(formData.job_title) : null,
            employment_start_date: formData.employment_start_date || null,
            annual_income_encrypted: formData.annual_income ? encrypt(formData.annual_income) : null,
            employment_contract_type: formData.employment_contract_type || null,
            business_name_encrypted: formData.business_name ? encrypt(formData.business_name) : null,
            nature_of_business_encrypted: formData.nature_of_business ? encrypt(formData.nature_of_business) : null,
            years_trading: formData.years_trading ? parseInt(formData.years_trading) : null,
            annual_turnover_encrypted: formData.annual_turnover ? encrypt(formData.annual_turnover) : null,
            additional_income_type: formData.additional_income_type || null,
            additional_income_amount_encrypted: formData.additional_income_amount ? encrypt(formData.additional_income_amount) : null,
            previous_rental_address_encrypted: formData.previous_rental_address ? encrypt(formData.previous_rental_address) : null,
            previous_landlord_name_encrypted: formData.previous_landlord_name ? encrypt(formData.previous_landlord_name) : null,
            previous_landlord_email_encrypted: formData.previous_landlord_email ? encrypt(formData.previous_landlord_email) : null,
            previous_landlord_phone_encrypted: formData.previous_landlord_phone ? encrypt(formData.previous_landlord_phone) : null,
            previous_rental_start_date: formData.previous_rental_start_date || null,
            previous_rental_end_date: formData.previous_rental_end_date || null,
            previous_monthly_rent_encrypted: formData.previous_monthly_rent ? encrypt(formData.previous_monthly_rent) : null,
            monthly_rent: formData.monthly_rent ? parseFloat(formData.monthly_rent) : null,
            move_in_date: formData.move_in_date || null,
            term_years: formData.term_years ? parseInt(formData.term_years) : 0,
            term_months: formData.term_months ? parseInt(formData.term_months) : 0,
            id_document_type: formData.id_document_type || null,
            id_document_path: idDocumentPath,
            signature_encrypted: formData.signature ? encrypt(formData.signature) : null,
            signature_name_encrypted: formData.signature_name ? encrypt(formData.signature_name) : null,
            signed_at: formData.signature ? new Date().toISOString() : null,
            notes_encrypted: formData.notes ? encrypt(formData.notes) : null,
            updated_at: new Date().toISOString()
        }

        // Update application
        const { data: updatedApplication, error: updateError } = await supabase
            .from('tenant_applications')
            .update(updateData)
            .eq('id', application.id)
            .select()
            .single()

        if (updateError) {
            return res.status(400).json({ error: updateError.message })
        }

        // Get company details for email
        const { data: company } = await supabase
            .from('companies')
            .select('name_encrypted, phone_encrypted, email_encrypted')
            .eq('id', application.company_id)
            .single()

        const companyName = company?.name_encrypted ? decrypt(company.name_encrypted) : 'PropertyGoose'
        const companyPhone = company?.phone_encrypted ? decrypt(company.phone_encrypted) : ''
        const companyEmail = company?.email_encrypted ? decrypt(company.email_encrypted) : ''

        // Send notification email to agent
        const agentEmail = application.agent_email_encrypted ? decrypt(application.agent_email_encrypted) : ''
        const applicantName = formData.first_name && formData.last_name
            ? `${formData.first_name} ${formData.last_name}`
            : 'Applicant'
        const propertyAddress = application.property_address_encrypted
            ? decrypt(application.property_address_encrypted)
            : ''

        const dashboardUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/applications/${application.id}`

        try {
            await sendApplicationCompletedNotification(
                agentEmail || '',
                applicantName,
                propertyAddress || '',
                dashboardUrl,
                companyName || '',
                companyPhone || undefined,
                companyEmail || undefined
            )
            console.log('Application completion email sent to agent:', agentEmail)
        } catch (emailError: any) {
            console.error('Failed to send completion email:', emailError)
            // Don't fail the request if email fails
        }

        res.json({
            success: true,
            message: 'Application submitted successfully',
            application: {
                id: updatedApplication.id,
                status: updatedApplication.status,
                submitted_at: updatedApplication.submitted_at
            }
        })
    } catch (error: any) {
        console.error('Error submitting application:', error)
        res.status(500).json({ error: error.message })
    }
})

export default router

