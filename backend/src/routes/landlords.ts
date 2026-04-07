import { Router } from 'express'
import { authenticateToken, requireMember, AuthRequest, getCompanyIdForRequest } from '../middleware/auth'
import { supabase } from '../config/supabase'
import { encrypt, decrypt, generateToken, hash } from '../services/encryption'
import * as creditService from '../services/creditService'
import * as billingService from '../services/billingService'
import multer from 'multer'
import { sendLandlordVerificationRequest } from '../services/emailService'
import { sanctionsService } from '../services/sanctionsService'
import { DEFAULT_BRANDING } from '../config/colors'
import { getFrontendUrl } from '../utils/frontendUrl'

const router = Router()
const frontendUrl = getFrontendUrl()

// Configure multer for file uploads (store in memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'text/csv']
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Invalid file type. Only PDF, images, and CSV are allowed.'))
    }
  }
})

/**
 * GET /api/landlords
 * Get all landlords for the authenticated user's company
 * Supports pagination with ?page=1&limit=50
 */
router.get('/', authenticateToken, requireMember, async (req: AuthRequest, res) => {
  try {
    const companyId = req.companyId!

    const { search, aml_status, page, limit } = req.query

    // Pagination settings
    const pageNum = Math.max(1, parseInt(page as string) || 1)
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 50))
    const offset = (pageNum - 1) * limitNum

    // Get total count for pagination metadata
    let countQuery = supabase
      .from('landlords')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)

    if (aml_status && typeof aml_status === 'string') {
      countQuery = countQuery.eq('aml_status', aml_status)
    }

    const { count: totalCount } = await countQuery

    // Build query - only select fields needed for list view
    let query = supabase
      .from('landlords')
      .select(`
        id,
        company_id,
        first_name_encrypted,
        last_name_encrypted,
        email_encrypted,
        is_company,
        company_name_encrypted,
        aml_status,
        aml_completed_at,
        created_at
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })

    // Apply AML status filter
    if (aml_status && typeof aml_status === 'string') {
      query = query.eq('aml_status', aml_status)
    }

    // Apply pagination if no search (search requires full dataset for encrypted field filtering)
    if (!search) {
      query = query.range(offset, offset + limitNum - 1)
    }

    const { data: landlords, error } = await query

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    // Decrypt only the fields needed for list view
    const decryptedLandlords = landlords?.map(landlord => ({
      id: landlord.id,
      company_id: landlord.company_id,
      first_name: decrypt(landlord.first_name_encrypted),
      last_name: decrypt(landlord.last_name_encrypted),
      email: decrypt(landlord.email_encrypted),
      is_company: landlord.is_company,
      company_name: decrypt(landlord.company_name_encrypted),
      aml_status: landlord.aml_status,
      aml_completed_at: landlord.aml_completed_at,
      created_at: landlord.created_at
    })) || []

    // Apply search filter if provided (after decryption)
    let filteredLandlords = decryptedLandlords
    if (search && typeof search === 'string') {
      const searchLower = search.toLowerCase()
      filteredLandlords = decryptedLandlords.filter(landlord => {
        const fullName = `${landlord.first_name || ''} ${landlord.last_name || ''}`.toLowerCase()
        const email = (landlord.email || '').toLowerCase()
        const companyName = (landlord.company_name || '').toLowerCase()
        return fullName.includes(searchLower) || email.includes(searchLower) || companyName.includes(searchLower)
      })
      // Apply pagination to search results
      const searchTotal = filteredLandlords.length
      filteredLandlords = filteredLandlords.slice(offset, offset + limitNum)

      res.json({
        landlords: filteredLandlords,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: searchTotal,
          totalPages: Math.ceil(searchTotal / limitNum)
        }
      })
      return
    }

    res.json({
      landlords: filteredLandlords,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount || 0,
        totalPages: Math.ceil((totalCount || 0) / limitNum)
      }
    })
  } catch (error: any) {
    console.error('Error fetching landlords:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/landlords/csv-template
 * Download CSV template for landlord import
 * NOTE: This route must be defined BEFORE /:id to avoid being caught by the parameterized route
 */
router.get('/csv-template', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const headers = [
      'Title',
      'First Name',
      'Last Name',
      'Preferred Email Greeting',
      'Phone',
      'Email',
      'DOB (DD/MM/YYYY)',
      'Address Line 1',
      'Address Line 2',
      'City',
      'Postcode',
      'Bank Account Name',
      'Bank Account Number',
      'Bank Sort Code',
      'Joint Account (Y/N)',
      'Landlord Registration Number'
    ]

    const csv = headers.join(',') + '\n'

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename="landlord-import-template.csv"')
    res.send(csv)
  } catch (error: any) {
    console.error('Error generating CSV template:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/landlords/:id/rent-hold
 * Toggle rent hold on/off for a landlord
 */
router.post('/:id/rent-hold', authenticateToken, requireMember, async (req: AuthRequest, res) => {
  try {
    const companyId = req.companyId!
    const { active, note } = req.body

    const updateData: Record<string, any> = {
      rent_hold_active: !!active,
      rent_hold_note: active ? (note || null) : null,
      rent_hold_set_at: active ? new Date().toISOString() : null,
      rent_hold_set_by: active ? req.user?.id : null,
      updated_at: new Date().toISOString()
    }

    const { error } = await supabase
      .from('landlords')
      .update(updateData)
      .eq('id', req.params.id)
      .eq('company_id', companyId)

    if (error) return res.status(400).json({ error: error.message })

    res.json({ success: true, rent_hold_active: !!active })
  } catch (error: any) {
    console.error('Error toggling rent hold:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/landlords/:id
 * Get a single landlord by ID
 */
router.get('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    const landlordId = req.params.id

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // Get company from X-Branch-Id header or user's company
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    // Get landlord
    const { data: landlord, error } = await supabase
      .from('landlords')
      .select('*')
      .eq('id', landlordId)
      .eq('company_id', companyId)
      .single()

    if (error || !landlord) {
      return res.status(404).json({ error: 'Landlord not found' })
    }

    // Get properties (legacy landlord_properties table)
    const { data: properties } = await supabase
      .from('landlord_properties')
      .select('*')
      .eq('landlord_id', landlordId)

    // Get linked properties from property_landlords table (new properties module)
    const { data: linkedProperties } = await supabase
      .from('property_landlords')
      .select(`
        id,
        ownership_percentage,
        is_primary_contact,
        property:properties (
          id,
          postcode,
          address_line1_encrypted,
          address_line2_encrypted,
          city_encrypted,
          full_address_encrypted,
          property_type,
          number_of_bedrooms,
          status
        )
      `)
      .eq('landlord_id', landlordId)

    // Get AML check if exists
    const { data: amlCheck } = await supabase
      .from('landlord_aml_checks')
      .select('*')
      .eq('landlord_id', landlordId)
      .maybeSingle()

    // Decrypt landlord data
    const decryptedLandlord = {
      id: landlord.id,
      company_id: landlord.company_id,
      title: decrypt(landlord.title_encrypted),
      first_name: decrypt(landlord.first_name_encrypted),
      middle_name: decrypt(landlord.middle_name_encrypted),
      last_name: decrypt(landlord.last_name_encrypted),
      preferred_email_greeting: decrypt(landlord.preferred_email_greeting_encrypted),
      full_name_displayed_on_contracts: decrypt(landlord.full_name_displayed_on_contracts_encrypted),
      phone: decrypt(landlord.phone_encrypted),
      email: decrypt(landlord.email_encrypted),
      date_of_birth: landlord.date_of_birth,
      is_company: landlord.is_company,
      company_name: decrypt(landlord.company_name_encrypted),
      residential_address: {
        line1: decrypt(landlord.residential_address_line1_encrypted),
        line2: decrypt(landlord.residential_address_line2_encrypted),
        city: decrypt(landlord.residential_city_encrypted),
        postcode: decrypt(landlord.residential_postcode_encrypted),
        country: decrypt(landlord.residential_country_encrypted)
      },
      has_section48_address: landlord.has_section48_address,
      section48_address: landlord.has_section48_address ? {
        line1: decrypt(landlord.section48_address_line1_encrypted),
        line2: decrypt(landlord.section48_address_line2_encrypted),
        city: decrypt(landlord.section48_city_encrypted),
        postcode: decrypt(landlord.section48_postcode_encrypted),
        country: decrypt(landlord.section48_country_encrypted)
      } : null,
      bank_details: {
        account_name: decrypt(landlord.bank_account_name_encrypted),
        account_number: decrypt(landlord.bank_account_number_encrypted),
        sort_code: decrypt(landlord.bank_sort_code_encrypted),
        is_joint_account: landlord.is_joint_account
      },
      regulatory: {
        landlord_registration_number: landlord.landlord_registration_number,
        landlord_license_number: landlord.landlord_license_number,
        agent_sign_on_behalf: landlord.agent_sign_on_behalf
      },
      aml_status: landlord.aml_status,
      aml_completed_at: landlord.aml_completed_at,
      verification_status: landlord.verification_status,
      verification_submitted_at: landlord.verification_submitted_at,
      verification_verified_at: landlord.verification_verified_at,
      properties: properties?.map(prop => ({
        id: prop.id,
        address: {
          line1: decrypt(prop.address_line1_encrypted),
          line2: decrypt(prop.address_line2_encrypted),
          city: decrypt(prop.city_encrypted),
          county: decrypt(prop.county_encrypted),
          postcode: decrypt(prop.postcode_encrypted),
          country: decrypt(prop.country_encrypted)
        },
        property_type: prop.property_type,
        number_of_bedrooms: prop.number_of_bedrooms,
        number_of_bathrooms: prop.number_of_bathrooms,
        created_at: prop.created_at
      })) || [],
      aml_check: amlCheck ? {
        id: amlCheck.id,
        verification_status: amlCheck.verification_status,
        verification_score: amlCheck.verification_score,
        pep_check_result: amlCheck.pep_check_result,
        sanctions_check_result: amlCheck.sanctions_check_result,
        adverse_media_result: amlCheck.adverse_media_result,
        risk_level: amlCheck.risk_level,
        document_verified: amlCheck.document_verified,
        selfie_matches_id: amlCheck.selfie_matches_id,
        id_document_type: amlCheck.id_document_type,
        id_document_path: amlCheck.id_document_path,
        selfie_path: amlCheck.selfie_path,
        created_at: amlCheck.created_at,
        verified_at: amlCheck.verified_at,
        fraud_indicators: amlCheck.fraud_indicators,
      } : null,
      linked_properties: linkedProperties?.map((lp: any) => ({
        id: lp.id,
        property_id: lp.property?.id,
        ownership_percentage: lp.ownership_percentage,
        is_primary_contact: lp.is_primary_contact,
        address: lp.property ? {
          line1: decrypt(lp.property.address_line1_encrypted),
          line2: decrypt(lp.property.address_line2_encrypted),
          city: decrypt(lp.property.city_encrypted),
          full_address: decrypt(lp.property.full_address_encrypted),
          postcode: lp.property.postcode
        } : null,
        property_type: lp.property?.property_type,
        number_of_bedrooms: lp.property?.number_of_bedrooms,
        status: lp.property?.status
      })) || [],
      created_at: landlord.created_at,
      updated_at: landlord.updated_at
    }

    res.json({ landlord: decryptedLandlord })
  } catch (error: any) {
    console.error('Error fetching landlord:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/landlords
 * Create a new landlord
 */
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
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

    const {
      title,
      first_name,
      middle_name,
      last_name,
      preferred_email_greeting,
      full_name_displayed_on_contracts,
      phone,
      email,
      date_of_birth,
      is_company,
      company_name,
      residential_address,
      has_section48_address,
      section48_address,
      bank_details,
      regulatory,
      properties
    } = req.body

    // Validation
    if (!first_name || !last_name || !email) {
      return res.status(400).json({ error: 'First name, last name, and email are required' })
    }

    // Prepare encrypted data
    const landlordData: any = {
      company_id: companyId,
      title_encrypted: title ? encrypt(title) : null,
      first_name_encrypted: encrypt(first_name),
      middle_name_encrypted: middle_name ? encrypt(middle_name) : null,
      last_name_encrypted: encrypt(last_name),
      preferred_email_greeting_encrypted: preferred_email_greeting ? encrypt(preferred_email_greeting) : null,
      full_name_displayed_on_contracts_encrypted: full_name_displayed_on_contracts ? encrypt(full_name_displayed_on_contracts) : null,
      phone_encrypted: phone ? encrypt(phone) : null,
      email_encrypted: encrypt(email),
      date_of_birth: date_of_birth || null,
      is_company: is_company || false,
      company_name_encrypted: company_name ? encrypt(company_name) : null,
      residential_address_line1_encrypted: residential_address?.line1 ? encrypt(residential_address.line1) : null,
      residential_address_line2_encrypted: residential_address?.line2 ? encrypt(residential_address.line2) : null,
      residential_city_encrypted: residential_address?.city ? encrypt(residential_address.city) : null,
      residential_postcode_encrypted: residential_address?.postcode ? encrypt(residential_address.postcode) : null,
      residential_country_encrypted: residential_address?.country ? encrypt(residential_address.country || 'GB') : null,
      has_section48_address: has_section48_address || false,
      section48_address_line1_encrypted: section48_address?.line1 ? encrypt(section48_address.line1) : null,
      section48_address_line2_encrypted: section48_address?.line2 ? encrypt(section48_address.line2) : null,
      section48_city_encrypted: section48_address?.city ? encrypt(section48_address.city) : null,
      section48_postcode_encrypted: section48_address?.postcode ? encrypt(section48_address.postcode) : null,
      section48_country_encrypted: section48_address?.country ? encrypt(section48_address.country || 'GB') : null,
      bank_account_name_encrypted: bank_details?.account_name ? encrypt(bank_details.account_name) : null,
      bank_account_number_encrypted: bank_details?.account_number ? encrypt(bank_details.account_number) : null,
      bank_sort_code_encrypted: bank_details?.sort_code ? encrypt(bank_details.sort_code) : null,
      is_joint_account: bank_details?.is_joint_account || false,
      landlord_registration_number: regulatory?.landlord_registration_number || null,
      landlord_license_number: regulatory?.landlord_license_number || null,
      agent_sign_on_behalf: regulatory?.agent_sign_on_behalf || false,
      created_by: userId
    }

    // Insert landlord
    const { data: landlord, error } = await supabase
      .from('landlords')
      .insert(landlordData)
      .select()
      .single()

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    // Insert properties if provided
    if (properties && Array.isArray(properties) && properties.length > 0) {
      const propertyData = properties.map((prop: any) => ({
        landlord_id: landlord.id,
        address_line1_encrypted: encrypt(prop.address.line1),
        address_line2_encrypted: prop.address.line2 ? encrypt(prop.address.line2) : null,
        city_encrypted: encrypt(prop.address.city),
        county_encrypted: prop.address.county ? encrypt(prop.address.county) : null,
        postcode_encrypted: encrypt(prop.address.postcode),
        country_encrypted: encrypt(prop.address.country || 'GB'),
        property_type: prop.property_type || null,
        number_of_bedrooms: prop.number_of_bedrooms || null,
        number_of_bathrooms: prop.number_of_bathrooms || null
      }))

      await supabase
        .from('landlord_properties')
        .insert(propertyData)
    }

    res.status(201).json({
      message: 'Landlord created successfully',
      landlord: { id: landlord.id }
    })
  } catch (error: any) {
    console.error('Error creating landlord:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * PUT /api/landlords/:id
 * Update a landlord
 */
router.put('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    const landlordId = req.params.id

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // Get company from X-Branch-Id header or user's company
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    // Verify landlord belongs to company
    const { data: existingLandlord } = await supabase
      .from('landlords')
      .select('id')
      .eq('id', landlordId)
      .eq('company_id', companyId)
      .single()

    if (!existingLandlord) {
      return res.status(404).json({ error: 'Landlord not found' })
    }

    const {
      title,
      first_name,
      middle_name,
      last_name,
      preferred_email_greeting,
      full_name_displayed_on_contracts,
      phone,
      email,
      date_of_birth,
      is_company,
      company_name,
      residential_address,
      has_section48_address,
      section48_address,
      bank_details,
      regulatory
    } = req.body

    // Prepare update data
    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    if (title !== undefined) updateData.title_encrypted = title ? encrypt(title) : null
    if (first_name !== undefined) updateData.first_name_encrypted = encrypt(first_name)
    if (middle_name !== undefined) updateData.middle_name_encrypted = middle_name ? encrypt(middle_name) : null
    if (last_name !== undefined) updateData.last_name_encrypted = encrypt(last_name)
    if (preferred_email_greeting !== undefined) updateData.preferred_email_greeting_encrypted = preferred_email_greeting ? encrypt(preferred_email_greeting) : null
    if (full_name_displayed_on_contracts !== undefined) updateData.full_name_displayed_on_contracts_encrypted = full_name_displayed_on_contracts ? encrypt(full_name_displayed_on_contracts) : null
    if (phone !== undefined) updateData.phone_encrypted = phone ? encrypt(phone) : null
    if (email !== undefined) updateData.email_encrypted = encrypt(email)
    if (date_of_birth !== undefined) updateData.date_of_birth = date_of_birth || null
    if (is_company !== undefined) updateData.is_company = is_company
    if (company_name !== undefined) updateData.company_name_encrypted = company_name ? encrypt(company_name) : null

    if (residential_address) {
      if (residential_address.line1 !== undefined) updateData.residential_address_line1_encrypted = residential_address.line1 ? encrypt(residential_address.line1) : null
      if (residential_address.line2 !== undefined) updateData.residential_address_line2_encrypted = residential_address.line2 ? encrypt(residential_address.line2) : null
      if (residential_address.city !== undefined) updateData.residential_city_encrypted = residential_address.city ? encrypt(residential_address.city) : null
      if (residential_address.postcode !== undefined) updateData.residential_postcode_encrypted = residential_address.postcode ? encrypt(residential_address.postcode) : null
      if (residential_address.country !== undefined) updateData.residential_country_encrypted = residential_address.country ? encrypt(residential_address.country || 'GB') : null
    }

    if (has_section48_address !== undefined) updateData.has_section48_address = has_section48_address

    if (section48_address) {
      if (section48_address.line1 !== undefined) updateData.section48_address_line1_encrypted = section48_address.line1 ? encrypt(section48_address.line1) : null
      if (section48_address.line2 !== undefined) updateData.section48_address_line2_encrypted = section48_address.line2 ? encrypt(section48_address.line2) : null
      if (section48_address.city !== undefined) updateData.section48_city_encrypted = section48_address.city ? encrypt(section48_address.city) : null
      if (section48_address.postcode !== undefined) updateData.section48_postcode_encrypted = section48_address.postcode ? encrypt(section48_address.postcode) : null
      if (section48_address.country !== undefined) updateData.section48_country_encrypted = section48_address.country ? encrypt(section48_address.country || 'GB') : null
    }

    if (bank_details) {
      if (bank_details.account_name !== undefined) updateData.bank_account_name_encrypted = bank_details.account_name ? encrypt(bank_details.account_name) : null
      if (bank_details.account_number !== undefined) updateData.bank_account_number_encrypted = bank_details.account_number ? encrypt(bank_details.account_number) : null
      if (bank_details.sort_code !== undefined) updateData.bank_sort_code_encrypted = bank_details.sort_code ? encrypt(bank_details.sort_code) : null
      if (bank_details.is_joint_account !== undefined) updateData.is_joint_account = bank_details.is_joint_account
    }

    if (regulatory) {
      if (regulatory.landlord_registration_number !== undefined) updateData.landlord_registration_number = regulatory.landlord_registration_number || null
      if (regulatory.landlord_license_number !== undefined) updateData.landlord_license_number = regulatory.landlord_license_number || null
      if (regulatory.agent_sign_on_behalf !== undefined) updateData.agent_sign_on_behalf = regulatory.agent_sign_on_behalf
    }

    // Update landlord
    const { error: updateError } = await supabase
      .from('landlords')
      .update(updateData)
      .eq('id', landlordId)

    if (updateError) {
      return res.status(400).json({ error: updateError.message })
    }

    res.json({ message: 'Landlord updated successfully' })
  } catch (error: any) {
    console.error('Error updating landlord:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * DELETE /api/landlords/:id
 * Delete a landlord
 */
router.delete('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    const landlordId = req.params.id

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // Get company from X-Branch-Id header or user's company
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    // Verify landlord belongs to company
    const { data: existingLandlord } = await supabase
      .from('landlords')
      .select('id')
      .eq('id', landlordId)
      .eq('company_id', companyId)
      .single()

    if (!existingLandlord) {
      return res.status(404).json({ error: 'Landlord not found' })
    }

    // Delete landlord (cascade will delete properties and AML checks)
    const { error } = await supabase
      .from('landlords')
      .delete()
      .eq('id', landlordId)

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    res.json({ message: 'Landlord deleted successfully' })
  } catch (error: any) {
    console.error('Error deleting landlord:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/landlords/bulk-delete
 * Delete multiple landlords
 */
router.post('/bulk-delete', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    const { ids } = req.body

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No landlord IDs provided' })
    }

    // Get company from X-Branch-Id header or user's company
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    // Verify all landlords belong to the company
    const { data: landlords } = await supabase
      .from('landlords')
      .select('id')
      .in('id', ids)
      .eq('company_id', companyId)

    if (!landlords || landlords.length === 0) {
      return res.status(404).json({ error: 'No landlords found' })
    }

    const validIds = landlords.map(l => l.id)

    // Delete landlords (cascade will delete properties and AML checks)
    const { error } = await supabase
      .from('landlords')
      .delete()
      .in('id', validIds)

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    res.json({ message: 'Landlords deleted successfully', deleted: validIds.length })
  } catch (error: any) {
    console.error('Error bulk deleting landlords:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/landlords/import-csv
 * Import landlords from CSV file with field mapping
 */
router.post('/import-csv', authenticateToken, upload.single('csv'), async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    if (!req.file) {
      return res.status(400).json({ error: 'CSV file is required' })
    }

    // Get company from X-Branch-Id header or user's company
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    // Parse CSV
    const csvContent = req.file.buffer.toString('utf-8')
    const lines = csvContent.split('\n').filter(line => line.trim())
    if (lines.length < 2) {
      return res.status(400).json({ error: 'CSV file must have at least a header row and one data row' })
    }

    // Get field mapping from request body (safely parse JSON)
    let fieldMapping: Record<string, string> = {}
    if (req.body.fieldMapping) {
      try {
        fieldMapping = JSON.parse(req.body.fieldMapping)
      } catch {
        return res.status(400).json({ error: 'Invalid field mapping format' })
      }
    }

    // Properly parse a CSV line handling quoted fields with commas
    const parseCSVLine = (line: string): string[] => {
      const result: string[] = []
      let current = ''
      let inQuotes = false

      for (let i = 0; i < line.length; i++) {
        const char = line[i]

        if (char === '"') {
          // Check for escaped quote (two consecutive quotes)
          if (inQuotes && line[i + 1] === '"') {
            current += '"'
            i++ // Skip the next quote
          } else {
            inQuotes = !inQuotes
          }
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim())
          current = ''
        } else {
          current += char
        }
      }

      // Don't forget the last field
      result.push(current.trim())

      return result
    }

    // Parse header row
    const headers = parseCSVLine(lines[0])

    // Parse data rows
    const csvData: any[] = []
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i])
      const row: any = {}
      headers.forEach((header, index) => {
        row[header] = values[index] || ''
      })
      csvData.push(row)
    }

    // Map CSV fields to landlord fields using fieldMapping
    const landlordsToInsert: any[] = []
    for (const row of csvData) {
      const landlordData: any = {
        company_id: companyId,
        created_by: userId
      }

      // Map fields based on fieldMapping
      // Personal details
      if (fieldMapping.title && row[fieldMapping.title]) {
        landlordData.title_encrypted = encrypt(row[fieldMapping.title])
      }
      if (fieldMapping.first_name && row[fieldMapping.first_name]) {
        landlordData.first_name_encrypted = encrypt(row[fieldMapping.first_name])
      }
      if (fieldMapping.last_name && row[fieldMapping.last_name]) {
        landlordData.last_name_encrypted = encrypt(row[fieldMapping.last_name])
      }
      if (fieldMapping.preferred_email_greeting && row[fieldMapping.preferred_email_greeting]) {
        landlordData.preferred_email_greeting_encrypted = encrypt(row[fieldMapping.preferred_email_greeting])
      }
      if (fieldMapping.email && row[fieldMapping.email]) {
        landlordData.email_encrypted = encrypt(row[fieldMapping.email])
      }
      if (fieldMapping.phone && row[fieldMapping.phone]) {
        landlordData.phone_encrypted = encrypt(row[fieldMapping.phone])
      }
      // Date of birth - parse from DD/MM/YYYY format
      if (fieldMapping.date_of_birth && row[fieldMapping.date_of_birth]) {
        const dobValue = row[fieldMapping.date_of_birth].trim()
        // Try to parse DD/MM/YYYY format
        const dobMatch = dobValue.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
        if (dobMatch) {
          const day = dobMatch[1].padStart(2, '0')
          const month = dobMatch[2].padStart(2, '0')
          const year = dobMatch[3]
          landlordData.date_of_birth = `${year}-${month}-${day}` // ISO format for database
        } else if (dobValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
          // Already in ISO format
          landlordData.date_of_birth = dobValue
        }
      }
      // Address fields
      if (fieldMapping.address_line1 && row[fieldMapping.address_line1]) {
        landlordData.residential_address_line1_encrypted = encrypt(row[fieldMapping.address_line1])
      }
      if (fieldMapping.address_line2 && row[fieldMapping.address_line2]) {
        landlordData.residential_address_line2_encrypted = encrypt(row[fieldMapping.address_line2])
      }
      if (fieldMapping.city && row[fieldMapping.city]) {
        landlordData.residential_city_encrypted = encrypt(row[fieldMapping.city])
      }
      if (fieldMapping.postcode && row[fieldMapping.postcode]) {
        landlordData.residential_postcode_encrypted = encrypt(row[fieldMapping.postcode])
      }
      // Bank details
      if (fieldMapping.bank_account_name && row[fieldMapping.bank_account_name]) {
        landlordData.bank_account_name_encrypted = encrypt(row[fieldMapping.bank_account_name])
      }
      if (fieldMapping.bank_account_number && row[fieldMapping.bank_account_number]) {
        landlordData.bank_account_number_encrypted = encrypt(row[fieldMapping.bank_account_number])
      }
      if (fieldMapping.bank_sort_code && row[fieldMapping.bank_sort_code]) {
        landlordData.bank_sort_code_encrypted = encrypt(row[fieldMapping.bank_sort_code])
      }
      // Joint account - parse Y/N to boolean
      if (fieldMapping.is_joint_account && row[fieldMapping.is_joint_account]) {
        const jointValue = row[fieldMapping.is_joint_account].trim().toLowerCase()
        landlordData.is_joint_account = jointValue === 'y' || jointValue === 'yes' || jointValue === 'true' || jointValue === '1'
      }
      // Regulatory
      if (fieldMapping.landlord_registration_number && row[fieldMapping.landlord_registration_number]) {
        landlordData.landlord_registration_number = row[fieldMapping.landlord_registration_number]
      }

      // Validate required fields
      if (!landlordData.first_name_encrypted || !landlordData.last_name_encrypted || !landlordData.email_encrypted) {
        continue // Skip invalid rows
      }

      landlordsToInsert.push(landlordData)
    }

    if (landlordsToInsert.length === 0) {
      return res.status(400).json({ error: 'No valid landlord data found in CSV' })
    }

    // Insert landlords
    const { data: insertedLandlords, error } = await supabase
      .from('landlords')
      .insert(landlordsToInsert)
      .select('id')

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    res.json({
      message: `Successfully imported ${insertedLandlords?.length || 0} landlords`,
      count: insertedLandlords?.length || 0
    })
  } catch (error: any) {
    console.error('Error importing CSV:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/landlords/:id/request-id-verification
 * Request ID verification for a landlord - sends email with verification link
 */
router.post('/:id/request-id-verification', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    const landlordId = req.params.id

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // Get company from X-Branch-Id header or user's company
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    // Get landlord
    const { data: landlord, error: landlordError } = await supabase
      .from('landlords')
      .select('*')
      .eq('id', landlordId)
      .eq('company_id', companyId)
      .single()

    if (landlordError || !landlord) {
      return res.status(404).json({ error: 'Landlord not found' })
    }

    // Generate verification token
    const verificationToken = generateToken()
    const verificationTokenHash = hash(verificationToken)

    // Create or update landlord_aml_checks record with token
    const { data: amlCheck, error: amlError } = await supabase
      .from('landlord_aml_checks')
      .upsert({
        landlord_id: landlordId,
        verification_status: 'pending',
        verification_token_hash: verificationTokenHash,
        requested_at: new Date().toISOString(),
        requested_by: userId
      }, { onConflict: 'landlord_id' })
      .select()
      .single()

    if (amlError) {
      console.error('Error creating AML check record:', amlError)
      return res.status(500).json({ error: amlError.message })
    }

    // Update landlord status to indicate verification requested
    await supabase
      .from('landlords')
      .update({
        aml_status: 'requested',
        aml_checked_by: userId
      })
      .eq('id', landlordId)

    // Get landlord email for sending verification request
    const landlordEmail = decrypt(landlord.email_encrypted) || ''
    const landlordName = `${decrypt(landlord.first_name_encrypted) || ''} ${decrypt(landlord.last_name_encrypted) || ''}`.trim()

    // Build verification link
    const frontendUrl = getFrontendUrl()
    const verificationLink = `${frontendUrl}/landlord-verification/${landlordId}/${verificationToken}`

    // Send verification email
    try {
      await sendLandlordVerificationRequest(
        landlordEmail,
        landlordName,
        verificationLink,
        companyId
      )
      console.log(`Landlord verification email sent to ${landlordEmail}`)
    } catch (emailError) {
      console.error('Failed to send landlord verification email:', emailError)
      return res.status(500).json({ error: 'Failed to send verification email' })
    }

    res.json({
      message: 'Verification request sent to landlord',
      verification_sent: true
    })
  } catch (error: any) {
    console.error('Error requesting ID verification:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * @deprecated Use request-id-verification instead
 * POST /api/landlords/:id/initiate-aml-check
 * Kept for backwards compatibility - returns deprecation notice
 */
router.post('/:id/initiate-aml-check', authenticateToken, async (req: AuthRequest, res) => {
  return res.status(400).json({
    error: 'This endpoint is deprecated. Please use /request-id-verification instead.',
    redirect: `/api/landlords/${req.params.id}/request-id-verification`
  })
})

/**
 * GET /api/landlords/:id/verification/:token
 * Get landlord verification details by token - public route
 */
router.get('/:id/verification/:token', async (req, res) => {
  try {
    const landlordId = req.params.id
    const token = req.params.token

    if (!token) {
      return res.status(400).json({ error: 'Verification token is required' })
    }

    // Hash the token to compare with stored hash
    const tokenHash = hash(token)

    // Get AML check with token hash
    const { data: amlCheck, error: amlError } = await supabase
      .from('landlord_aml_checks')
      .select('id, landlord_id, verification_status, verification_token_hash')
      .eq('landlord_id', landlordId)
      .eq('verification_token_hash', tokenHash)
      .maybeSingle()

    if (amlError || !amlCheck) {
      return res.status(404).json({ error: 'Invalid verification link' })
    }

    // Get landlord
    const { data: landlord, error: landlordError } = await supabase
      .from('landlords')
      .select('id, company_id, first_name_encrypted, last_name_encrypted, email_encrypted, verification_status, verification_submitted_at')
      .eq('id', landlordId)
      .single()

    if (landlordError || !landlord) {
      return res.status(404).json({ error: 'Landlord not found' })
    }

    // Decrypt landlord data
    const decryptedLandlord = {
      id: landlord.id,
      first_name: decrypt(landlord.first_name_encrypted) || '',
      last_name: decrypt(landlord.last_name_encrypted) || '',
      email: decrypt(landlord.email_encrypted) || '',
      verification_status: landlord.verification_status,
      verification_submitted_at: landlord.verification_submitted_at
    }

    let companyDetails = null
    if (landlord.company_id) {
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .select('name_encrypted, phone_encrypted, email_encrypted, address_encrypted, city_encrypted, postcode_encrypted, website_encrypted, logo_url, primary_color, button_color')
        .eq('id', landlord.company_id)
        .single()

      if (!companyError && company) {
        companyDetails = {
          name: company.name_encrypted ? decrypt(company.name_encrypted) : '',
          phone: company.phone_encrypted ? decrypt(company.phone_encrypted) : '',
          email: company.email_encrypted ? decrypt(company.email_encrypted) : '',
          address: company.address_encrypted ? decrypt(company.address_encrypted) : '',
          city: company.city_encrypted ? decrypt(company.city_encrypted) : '',
          postcode: company.postcode_encrypted ? decrypt(company.postcode_encrypted) : '',
          website: company.website_encrypted ? decrypt(company.website_encrypted) : '',
          logo_url: company.logo_url || '',
          primary_color: company.primary_color || DEFAULT_BRANDING.primaryColor,
          button_color: company.button_color || DEFAULT_BRANDING.buttonColor
        }
      }
    }

    res.json({ landlord: decryptedLandlord, company: companyDetails })
  } catch (error: any) {
    console.error('Error fetching landlord verification:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/landlords/:id/submit-verification
 * Submit landlord verification (ID + selfie + personal details) - public route
 * Runs PEP and sanctions check after form submission
 */
router.post('/:id/submit-verification', upload.fields([
  { name: 'id_document', maxCount: 1 },
  { name: 'selfie', maxCount: 1 }
]), async (req: any, res) => {
  try {
    const landlordId = req.params.id
    const {
      token,
      id_document_type,
      first_name,
      last_name,
      date_of_birth,
      address_line1,
      address_line2,
      city,
      postcode,
      country
    } = req.body

    if (!token) {
      return res.status(400).json({ error: 'Verification token is required' })
    }

    // Validate required fields
    if (!first_name || !last_name || !date_of_birth || !address_line1 || !city || !postcode) {
      return res.status(400).json({ error: 'Personal details (name, date of birth, address) are required' })
    }

    // Verify token
    const tokenHash = hash(token)

    // Get AML check with token hash
    const { data: amlCheck, error: amlError } = await supabase
      .from('landlord_aml_checks')
      .select('id, landlord_id, verification_status, verification_token_hash, requested_by')
      .eq('landlord_id', landlordId)
      .eq('verification_token_hash', tokenHash)
      .maybeSingle()

    if (amlError || !amlCheck) {
      return res.status(404).json({ error: 'Invalid verification token' })
    }

    // Get landlord
    const { data: landlord, error: landlordError } = await supabase
      .from('landlords')
      .select('*')
      .eq('id', landlordId)
      .single()

    if (landlordError || !landlord) {
      return res.status(404).json({ error: 'Landlord not found' })
    }

    // Upload files to Supabase Storage
    const idDocumentFile = req.files?.id_document?.[0]
    const selfieFile = req.files?.selfie?.[0]

    if (!idDocumentFile || !selfieFile) {
      return res.status(400).json({ error: 'ID document and selfie are required' })
    }

    // Upload ID document to Supabase Storage
    const idDocExt = idDocumentFile.mimetype.split('/')[1] || 'pdf'
    const idDocFilename = `${landlordId}_id_${Date.now()}.${idDocExt}`
    const idDocumentPath = `landlord-documents/${landlordId}/${idDocFilename}`

    const { error: idUploadError } = await supabase.storage
      .from('reference-documents')
      .upload(idDocumentPath, idDocumentFile.buffer, {
        contentType: idDocumentFile.mimetype
      })

    if (idUploadError) {
      console.error('Error uploading ID document:', idUploadError)
      return res.status(500).json({ error: 'Failed to upload ID document' })
    }

    // Upload selfie to Supabase Storage
    const selfieExt = selfieFile.mimetype.split('/')[1] || 'jpg'
    const selfieFilename = `${landlordId}_selfie_${Date.now()}.${selfieExt}`
    const selfiePath = `landlord-documents/${landlordId}/${selfieFilename}`

    const { error: selfieUploadError } = await supabase.storage
      .from('reference-documents')
      .upload(selfiePath, selfieFile.buffer, {
        contentType: selfieFile.mimetype
      })

    if (selfieUploadError) {
      console.error('Error uploading selfie:', selfieUploadError)
      return res.status(500).json({ error: 'Failed to upload selfie' })
    }

    // Update landlord with submitted personal details
    const landlordUpdateData: any = {
      verification_status: 'submitted',
      verification_submitted_at: new Date().toISOString()
    }

    // Update name if not already set or if changed
    if (first_name) landlordUpdateData.first_name_encrypted = encrypt(first_name)
    if (last_name) landlordUpdateData.last_name_encrypted = encrypt(last_name)
    if (date_of_birth) landlordUpdateData.date_of_birth = date_of_birth
    if (address_line1) landlordUpdateData.residential_address_line1_encrypted = encrypt(address_line1)
    if (address_line2) landlordUpdateData.residential_address_line2_encrypted = encrypt(address_line2)
    if (city) landlordUpdateData.residential_city_encrypted = encrypt(city)
    if (postcode) landlordUpdateData.residential_postcode_encrypted = encrypt(postcode)
    if (country) landlordUpdateData.residential_country_encrypted = encrypt(country || 'GB')

    await supabase
      .from('landlords')
      .update(landlordUpdateData)
      .eq('id', landlordId)

    // Deduct credits (0.25 for landlord ID check)
    const companyId = landlord.company_id
    const creditCost = 0.25

    try {
      await creditService.deductCredits(companyId, creditCost, landlordId, `Landlord ID verification for ${first_name} ${last_name}`)
    } catch (creditError: any) {
      console.error('Error deducting credits:', creditError)
      // Continue anyway - don't block verification due to credit issues
    }

    // Run sanctions check - pass/fail is based solely on PEP and Sanctions results
    let sanctionsResult: any = null
    let pepCheckResult: boolean | null = null  // true = flagged (bad), false = clear (good), null = not checked
    let sanctionsCheckResult: boolean | null = null
    let adverseMediaResult: boolean | null = null
    let verificationPassed = true  // Default to passed, will be set to false if any flags found
    let riskLevel = 'low'
    let verificationStatus = 'passed'

    try {
      sanctionsResult = await sanctionsService.screenTenant({
        name: `${first_name} ${last_name}`,
        dateOfBirth: date_of_birth,
        postcode: postcode
      })

      if (sanctionsResult) {
        const apiUnavailable = typeof sanctionsResult.summary === 'string' &&
          sanctionsResult.summary.toLowerCase().includes('api unavailable')
        // Check if there are any sanctions matches (includes PEP list matches)
        const hasSanctionsMatches = sanctionsResult.sanctions_matches && sanctionsResult.sanctions_matches.length > 0
        const hasDonationMatches = sanctionsResult.donation_matches && sanctionsResult.donation_matches.length > 0

        if (apiUnavailable) {
          verificationPassed = false
          riskLevel = 'unknown'
          verificationStatus = 'pending'
          pepCheckResult = null
          sanctionsCheckResult = null
          adverseMediaResult = null
        } else {
          // true = flagged (bad), false = clear (good)
          pepCheckResult = hasDonationMatches
          sanctionsCheckResult = hasSanctionsMatches
          adverseMediaResult = false

          // Determine pass/fail based on PEP and Sanctions only
          if (hasSanctionsMatches) {
            riskLevel = 'high'
            verificationPassed = false
          } else if (hasDonationMatches) {
            // Donation matches suggest PEP - medium risk, still fails
            riskLevel = 'medium'
            verificationPassed = false
          }

          verificationStatus = verificationPassed ? 'passed' : 'failed'
        }
      }
    } catch (sanctionsError: any) {
      console.error('Sanctions screening error:', sanctionsError)
      sanctionsResult = { error: sanctionsError.message }
      verificationPassed = false
      riskLevel = 'unknown'
      verificationStatus = 'pending'
    }

    // Update AML check with results
    const amlCheckUpdate: any = {
      id_document_type: id_document_type || null,
      id_document_path: idDocumentPath,
      selfie_path: selfiePath,
      verification_status: verificationStatus,
      verification_submitted_at: new Date().toISOString(),
      verified_at: verificationStatus === 'pending' ? null : new Date().toISOString(),
      pep_check_result: pepCheckResult,
      sanctions_check_result: sanctionsCheckResult,
      adverse_media_result: adverseMediaResult,
      risk_level: riskLevel,
      sanctions_response: sanctionsResult ? JSON.stringify(sanctionsResult) : null
    }

    console.log('Updating AML check with:', amlCheckUpdate)
    const { error: amlUpdateError } = await supabase
      .from('landlord_aml_checks')
      .update(amlCheckUpdate)
      .eq('id', amlCheck.id)

    if (amlUpdateError) {
      console.error('Error updating AML check:', amlUpdateError)
    }

    // Update landlord AML status
    await supabase
      .from('landlords')
      .update({
        aml_status: verificationStatus === 'pending' ? 'submitted' : (verificationPassed ? 'passed' : 'failed'),
        aml_completed_at: verificationStatus === 'pending' ? null : new Date().toISOString(),
        verification_status: verificationStatus === 'pending' ? 'submitted' : (verificationPassed ? 'verified' : 'failed'),
        verification_verified_at: verificationStatus === 'pending' ? null : new Date().toISOString()
      })
      .eq('id', landlordId)

    res.json({
      message: verificationPassed
        ? 'Verification completed successfully. Your identity has been verified.'
        : 'Verification completed. Some checks may require manual review.',
      verification_passed: verificationPassed,
      risk_level: riskLevel
    })
  } catch (error: any) {
    console.error('Error submitting verification:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/landlords/:id/document/:type
 * Download landlord verification document (ID or selfie)
 */
router.get('/:id/document/:type', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    const landlordId = req.params.id
    const docType = req.params.type // 'id' or 'selfie'

    if (!['id', 'selfie'].includes(docType)) {
      return res.status(400).json({ error: 'Invalid document type. Use "id" or "selfie"' })
    }

    // Get company from X-Branch-Id header or user's company
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    // Verify landlord belongs to user's company
    const { data: landlord, error: landlordError } = await supabase
      .from('landlords')
      .select('id, company_id')
      .eq('id', landlordId)
      .eq('company_id', companyId)
      .single()

    if (landlordError || !landlord) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Get the AML check with document paths
    const { data: amlCheck, error: amlError } = await supabase
      .from('landlord_aml_checks')
      .select('id_document_path, selfie_path')
      .eq('landlord_id', landlordId)
      .maybeSingle()

    if (amlError || !amlCheck) {
      return res.status(404).json({ error: 'No verification documents found' })
    }

    const filePath = docType === 'id' ? amlCheck.id_document_path : amlCheck.selfie_path

    if (!filePath) {
      return res.status(404).json({ error: `No ${docType} document found` })
    }

    // Download file from storage
    const { data, error: downloadError } = await supabase.storage
      .from('reference-documents')
      .download(filePath)

    if (downloadError) {
      console.error('Error downloading file:', downloadError)
      return res.status(404).json({ error: 'File not found' })
    }

    // Get file extension to set correct content type
    const ext = filePath.split('.').pop()?.toLowerCase()
    const contentTypes: { [key: string]: string } = {
      'pdf': 'application/pdf',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp'
    }

    const contentType = contentTypes[ext || ''] || 'application/octet-stream'

    // Convert blob to buffer
    const arrayBuffer = await data.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Set headers and send file
    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Disposition', `inline; filename="${filePath.split('/').pop()}"`)
    res.send(buffer)
  } catch (error: any) {
    console.error('Error downloading landlord document:', error)
    res.status(500).json({ error: error.message })
  }
})

export default router
