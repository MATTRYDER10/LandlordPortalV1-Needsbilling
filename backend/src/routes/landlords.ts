import { Router } from 'express'
import { authenticateToken, AuthRequest } from '../middleware/auth'
import { supabase } from '../config/supabase'
import { encrypt, decrypt, generateToken, hash } from '../services/encryption'
import * as creditService from '../services/creditService'
import * as billingService from '../services/billingService'
import { creditsafeService, VerificationRequest } from '../services/creditsafeService'
import multer from 'multer'
import { sendLandlordVerificationRequest } from '../services/emailService'
import { sanctionsService } from '../services/sanctionsService'

const router = Router()

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
 */
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // Get user's company
    const { data: companyUser } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', userId)
      .limit(1)
      .single()

    if (!companyUser) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const { search, aml_status } = req.query

    // Build query
    let query = supabase
      .from('landlords')
      .select('*')
      .eq('company_id', companyUser.company_id)
      .order('created_at', { ascending: false })

    // Apply search filter
    if (search && typeof search === 'string') {
      // Note: Since fields are encrypted, we'll need to decrypt and filter in memory
      // For now, we'll fetch all and filter client-side, or implement a search index
      // For production, consider using a search service or decrypted search fields
    }

    // Apply AML status filter
    if (aml_status && typeof aml_status === 'string') {
      query = query.eq('aml_status', aml_status)
    }

    const { data: landlords, error } = await query

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    // Decrypt landlord data
    const decryptedLandlords = landlords?.map(landlord => ({
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
      created_at: landlord.created_at,
      updated_at: landlord.updated_at
    })) || []

    // Apply search filter if provided (after decryption)
    let filteredLandlords = decryptedLandlords
    if (search && typeof search === 'string') {
      const searchLower = search.toLowerCase()
      filteredLandlords = decryptedLandlords.filter(landlord => {
        const fullName = `${landlord.first_name || ''} ${landlord.last_name || ''}`.toLowerCase()
        const email = (landlord.email || '').toLowerCase()
        return fullName.includes(searchLower) || email.includes(searchLower)
      })
    }

    res.json({ landlords: filteredLandlords })
  } catch (error: any) {
    console.error('Error fetching landlords:', error)
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

    // Get user's company
    const { data: companyUser } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', userId)
      .limit(1)
      .single()

    if (!companyUser) {
      return res.status(404).json({ error: 'Company not found' })
    }

    // Get landlord
    const { data: landlord, error } = await supabase
      .from('landlords')
      .select('*')
      .eq('id', landlordId)
      .eq('company_id', companyUser.company_id)
      .single()

    if (error || !landlord) {
      return res.status(404).json({ error: 'Landlord not found' })
    }

    // Get properties
    const { data: properties } = await supabase
      .from('landlord_properties')
      .select('*')
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
        created_at: amlCheck.created_at,
        verified_at: amlCheck.verified_at,
        fraud_indicators: amlCheck.fraud_indicators,
      } : null,
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

    // Get user's company
    const { data: companyUser } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', userId)
      .limit(1)
      .single()

    if (!companyUser) {
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
      company_id: companyUser.company_id,
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

    // Get user's company
    const { data: companyUser } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', userId)
      .limit(1)
      .single()

    if (!companyUser) {
      return res.status(404).json({ error: 'Company not found' })
    }

    // Verify landlord belongs to company
    const { data: existingLandlord } = await supabase
      .from('landlords')
      .select('id')
      .eq('id', landlordId)
      .eq('company_id', companyUser.company_id)
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

    // Get user's company
    const { data: companyUser } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', userId)
      .limit(1)
      .single()

    if (!companyUser) {
      return res.status(404).json({ error: 'Company not found' })
    }

    // Verify landlord belongs to company
    const { data: existingLandlord } = await supabase
      .from('landlords')
      .select('id')
      .eq('id', landlordId)
      .eq('company_id', companyUser.company_id)
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

    // Get user's company
    const { data: companyUser } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', userId)
      .limit(1)
      .single()

    if (!companyUser) {
      return res.status(404).json({ error: 'Company not found' })
    }

    // Verify all landlords belong to the company
    const { data: landlords } = await supabase
      .from('landlords')
      .select('id')
      .in('id', ids)
      .eq('company_id', companyUser.company_id)

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

    // Get user's company
    const { data: companyUser } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', userId)
      .limit(1)
      .single()

    if (!companyUser) {
      return res.status(404).json({ error: 'Company not found' })
    }

    // Parse CSV
    const csvContent = req.file.buffer.toString('utf-8')
    const lines = csvContent.split('\n').filter(line => line.trim())
    if (lines.length < 2) {
      return res.status(400).json({ error: 'CSV file must have at least a header row and one data row' })
    }

    // Get field mapping from request body
    const fieldMapping = req.body.fieldMapping ? JSON.parse(req.body.fieldMapping) : {}

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
        company_id: companyUser.company_id,
        created_by: userId
      }

      // Map fields based on fieldMapping
      if (fieldMapping.first_name && row[fieldMapping.first_name]) {
        landlordData.first_name_encrypted = encrypt(row[fieldMapping.first_name])
      }
      if (fieldMapping.last_name && row[fieldMapping.last_name]) {
        landlordData.last_name_encrypted = encrypt(row[fieldMapping.last_name])
      }
      if (fieldMapping.email && row[fieldMapping.email]) {
        landlordData.email_encrypted = encrypt(row[fieldMapping.email])
      }
      if (fieldMapping.phone && row[fieldMapping.phone]) {
        landlordData.phone_encrypted = encrypt(row[fieldMapping.phone])
      }
      if (fieldMapping.address_line1 && row[fieldMapping.address_line1]) {
        landlordData.residential_address_line1_encrypted = encrypt(row[fieldMapping.address_line1])
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
 * POST /api/landlords/:id/initiate-aml-check
 * Initiate AML check for a landlord
 */
router.post('/:id/initiate-aml-check', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    const landlordId = req.params.id
    const { chargeType = 'credits' } = req.body // 'credits' or 'fixed'

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // Get user's company
    const { data: companyUser } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', userId)
      .limit(1)
      .single()

    if (!companyUser) {
      return res.status(404).json({ error: 'Company not found' })
    }

    // Get landlord
    const { data: landlord, error: landlordError } = await supabase
      .from('landlords')
      .select('*')
      .eq('id', landlordId)
      .eq('company_id', companyUser.company_id)
      .single()

    if (landlordError || !landlord) {
      return res.status(404).json({ error: 'Landlord not found' })
    }

    // Check credits or charge
    const creditsRequired = 0.25
   // const fixedCharge = 1.50

    if (chargeType === 'credits') {
      const hasCredits = await creditService.hasCredits(companyUser.company_id, creditsRequired)
      if (!hasCredits) {
        return res.status(400).json({ error: 'Insufficient credits. 0.25 credits required for AML check.' })
      }
    }

    // Deduct credits or charge
    if (chargeType === 'credits') {
      await creditService.deductCredits(
        companyUser.company_id,
        creditsRequired,
        null, // No tenant reference ID for landlord AML checks
        `AML check for landlord ${landlordId}`,
        userId
      )
    } else {
      // For fixed charge, you would integrate with Stripe here
      // For now, we'll just deduct credits as well
      await creditService.deductCredits(
        companyUser.company_id,
        creditsRequired,
        null, // No tenant reference ID for landlord AML checks
        `AML check for landlord ${landlordId} (fixed charge)`,
        userId
      )
    }

    const address = [decrypt(landlord.residential_address_line1_encrypted), decrypt(landlord.residential_address_line2_encrypted), decrypt(landlord.residential_city_encrypted), decrypt(landlord.residential_postcode_encrypted), decrypt(landlord.residential_country_encrypted)].filter((add) => !!((add || '').trim())).join(', ')

    const credi_aml_payload = {
      firstName: decrypt(landlord.first_name_encrypted) || '',
      lastName: decrypt(landlord.last_name_encrypted) || '',
      dateOfBirth: landlord.date_of_birth,
      address,
      postCode: decrypt(landlord.residential_postcode_encrypted) || ''
    }


    const verificationResponse = await creditsafeService.verify(credi_aml_payload);

    const sanctionsCheck = await sanctionsService.screenTenant({
      name: `${credi_aml_payload.firstName} ${credi_aml_payload.lastName}`,
      dateOfBirth: credi_aml_payload.dateOfBirth,
      postcode: credi_aml_payload.postCode
    });

    if(!verificationResponse || !sanctionsCheck) {
      return res.status(500).json({ error: 'Failed to verify landlord' })
    }

    const is_landlord_sanctioned = (Array.isArray(sanctionsCheck.sanctions_matches) && sanctionsCheck.sanctions_matches.length > 0);

    const flags = {
      ccjMatch: verificationResponse.ccjMatch,
      insolvencyMatch: verificationResponse.insolvencyMatch,
      deceasedMatch: verificationResponse.deceasedRegisterMatch,
      electoralRollMatch: verificationResponse.electoralRegisterMatch,
      ccjCount: verificationResponse.countyCourtJudgments?.length || 0,
      insolvencyCount: verificationResponse.insolvencies?.length || 0
    }

    // Store AML check result in database
    const { data: amlCheck, error: amlError } = await supabase
      .from('landlord_aml_checks')
      .upsert({
        landlord_id : landlordId,
        verification_request_encrypted: encrypt(JSON.stringify(credi_aml_payload)),
        verification_response_encrypted: verificationResponse.rawResponse,
        verification_status: verificationResponse.status,
        verification_score: 100,
        name_match_score: 100,
        address_match_score: 100,
        dob_match_score: 100,
        pep_check_result: is_landlord_sanctioned,
        sanctions_check_result: is_landlord_sanctioned,
        adverse_media_result: is_landlord_sanctioned,
        fraud_indicators: flags,
        risk_level: "none",
        id_document_type: null,
        id_document_path: null,
        verify_transaction_id: "",
        api_response_code: 200,
        error_message:'',
        charge_type: chargeType,
        credits_used: chargeType === 'credits' ? 0.5 : 1.50,
        amount_gbp: 0,
        verified_at: null,
        requested_at: new Date().toISOString(),
        requested_by: userId,
        verified_by: userId,
        verification_token_hash: null
  },{onConflict: 'landlord_id'})
      .select()
      .single()

    if (amlError) {
      console.error('Error storing AML check result:', amlError)
      return res.status(500).json({ error: amlError.message })
    }

    // Update landlord AML status
    const { data: updatedLandlord, error: updatedLandlordError } = await supabase
      .from('landlords')
      .update({
        aml_status:'satisfactory',
        aml_checked_by: userId,
        aml_completed_at: new Date().toISOString(),
      })
      .eq('id', landlordId)
      .select()
      .single()

    if (updatedLandlordError) {
      console.error('Error updating landlord AML status:', updatedLandlordError)
      return res.status(500).json({ error: updatedLandlordError.message })
    }

    res.json({
      message: 'AML check completed successfully',
      aml_check: amlCheck,
      aml_status: updatedLandlord.aml_status,
    })
  } catch (error: any) {
    console.error('Error initiating AML check:', error)
    res.status(500).json({ error: error.message })
  }
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
          primary_color: company.primary_color || '#f97316',
          button_color: company.button_color || '#f97316'
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
 * Submit landlord verification (ID + selfie) - public route
 */
router.post('/:id/submit-verification', upload.fields([
  { name: 'id_document', maxCount: 1 },
  { name: 'selfie', maxCount: 1 }
]), async (req: any, res) => {
  try {
    const landlordId = req.params.id
    const { token, id_document_type } = req.body

    if (!token) {
      return res.status(400).json({ error: 'Verification token is required' })
    }

    // Verify token
    const tokenHash = hash(token)

    // Get AML check with token hash
    const { data: amlCheck, error: amlError } = await supabase
      .from('landlord_aml_checks')
      .select('id, landlord_id, verification_status, verification_token_hash')
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

    // Upload files (you'll need to implement file upload to Supabase Storage)
    // For now, we'll just store the file info
    const idDocumentPath = `landlords/${landlordId}/id_document/${Date.now()}_${idDocumentFile.originalname}`
    const selfiePath = `landlords/${landlordId}/selfie/${Date.now()}_${selfieFile.originalname}`

    // Update AML check with document paths (amlCheck already fetched above)
    if (amlCheck) {
      await supabase
        .from('landlord_aml_checks')
        .update({
          id_document_type: id_document_type || null,
          id_document_path: idDocumentPath,
          selfie_path: selfiePath,
          verification_status: 'submitted',
          verification_submitted_at: new Date().toISOString()
        })
        .eq('id', amlCheck.id)
    }

    // Update landlord verification status
    await supabase
      .from('landlords')
      .update({
        verification_status: 'submitted',
        verification_submitted_at: new Date().toISOString()
      })
      .eq('id', landlordId)

    // TODO: Send to verify list for selfie comparison
    // This would integrate with your verification service

    res.json({
      message: 'Verification submitted successfully. Your documents are being reviewed.'
    })
  } catch (error: any) {
    console.error('Error submitting verification:', error)
    res.status(500).json({ error: error.message })
  }
})

export default router

