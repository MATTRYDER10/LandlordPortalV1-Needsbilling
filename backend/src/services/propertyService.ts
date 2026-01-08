import { supabase } from '../config/supabase'
import { encrypt, decrypt } from './encryption'

// ============================================================================
// INTERFACES
// ============================================================================

export interface PropertyAddress {
  full_address?: string
  line1?: string
  line2?: string
  city?: string
  county?: string
  postcode: string
  country?: string
}

export interface LandlordAssignment {
  landlord_id?: string
  create_new?: boolean
  ownership_percentage: number
  is_primary_contact?: boolean
  // For inline creation
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
}

export interface PropertyData {
  address: PropertyAddress
  property_type?: string
  number_of_bedrooms?: number
  number_of_bathrooms?: number
  furnishing_status?: string
  management_type?: 'managed' | 'let_only'
  bills_included?: boolean
  is_licensed?: boolean
  license_number?: string
  license_expiry_date?: string
  license_authority?: string
  notes?: string
  landlords?: LandlordAssignment[]
}

export interface ComplianceData {
  compliance_type: string
  custom_type_name?: string
  issue_date: string
  expiry_date?: string
  certificate_number?: string
  issuer_name?: string
  issuer_company?: string
  notes?: string
}

export interface PropertyFilters {
  search?: string
  status?: 'vacant' | 'in_tenancy'
  compliance_status?: 'valid' | 'expiring_soon' | 'expired'
  has_landlord?: boolean
  is_licensed?: boolean
  sortBy?: 'created_at' | 'postcode' | 'status'
  sortOrder?: 'asc' | 'desc'
  page?: number
  limit?: number
}

export interface PropertyListItem {
  id: string
  address: string | null
  address_line1: string | null
  address_line2: string | null
  city: string | null
  county: string | null
  postcode: string
  status: string
  property_type: string | null
  management_type: 'managed' | 'let_only' | null
  bills_included: boolean
  is_licensed: boolean
  landlord_count: number
  compliance_status: 'valid' | 'expiring_soon' | 'expired' | 'none'
  next_expiry_date: string | null
  created_at: string
}

export interface PropertyDetail {
  id: string
  address: PropertyAddress & { formatted?: string }
  property_type: string | null
  number_of_bedrooms: number | null
  number_of_bathrooms: number | null
  furnishing_status: string | null
  management_type: 'managed' | 'let_only' | null
  bills_included: boolean
  status: string
  status_override: boolean
  is_licensed: boolean
  license_number: string | null
  license_expiry_date: string | null
  notes: string | null
  landlords: Array<{
    id: string
    landlord_id: string
    name: string
    email: string | null
    ownership_percentage: number
    is_primary_contact: boolean
  }>
  compliance: Array<{
    id: string
    type: string
    custom_type_name: string | null
    issue_date: string
    expiry_date: string
    status: string
    certificate_number: string | null
    documents: Array<{
      id: string
      file_name: string
      file_path: string
      is_current: boolean
    }>
  }>
  tenancies: Array<{
    id: string
    reference_id: string
    tenant_name: string
    status: string
    is_active: boolean
  }>
  documents: Array<{
    id: string
    file_name: string
    file_path: string
    tag: string
    uploaded_at: string
    description: string | null
  }>
  created_at: string
  updated_at: string
}

// ============================================================================
// PROPERTY SERVICE CLASS
// ============================================================================

class PropertyService {

  // --------------------------------------------------------------------------
  // CREATE
  // --------------------------------------------------------------------------

  async createProperty(
    data: PropertyData,
    companyId: string,
    userId: string
  ): Promise<{ id: string }> {
    // 1. Validate required fields
    if (!data.address.postcode) {
      throw new Error('Postcode is required')
    }

    // 2. Validate landlord ownership percentages sum to 100% if provided
    if (data.landlords && data.landlords.length > 0) {
      const totalOwnership = data.landlords.reduce(
        (sum, l) => sum + (l.ownership_percentage || 0), 0
      )
      if (Math.abs(totalOwnership - 100) > 0.01) {
        throw new Error(`Total ownership percentage must equal 100% (currently ${totalOwnership}%)`)
      }
    }

    // 3. Create property record
    const propertyData = {
      company_id: companyId,
      full_address_encrypted: data.address.full_address ? encrypt(data.address.full_address) : null,
      address_line1_encrypted: data.address.line1 ? encrypt(data.address.line1) : null,
      address_line2_encrypted: data.address.line2 ? encrypt(data.address.line2) : null,
      city_encrypted: data.address.city ? encrypt(data.address.city) : null,
      county_encrypted: data.address.county ? encrypt(data.address.county) : null,
      postcode: this.normalizePostcode(data.address.postcode),
      country: data.address.country || 'GB',
      property_type: data.property_type || null,
      number_of_bedrooms: data.number_of_bedrooms || null,
      number_of_bathrooms: data.number_of_bathrooms || null,
      furnishing_status: data.furnishing_status || null,
      management_type: data.management_type || null,
      bills_included: data.bills_included || false,
      is_licensed: data.is_licensed || false,
      license_number: data.license_number || null,
      license_expiry_date: data.license_expiry_date || null,
      license_authority: data.license_authority || null,
      notes_encrypted: data.notes ? encrypt(data.notes) : null,
      created_by: userId
    }

    const { data: property, error } = await supabase
      .from('properties')
      .insert(propertyData)
      .select('id')
      .single()

    if (error) {
      console.error('Failed to create property:', error)
      throw new Error(`Failed to create property: ${error.message}`)
    }

    // 4. Process landlords (create inline or link existing)
    if (data.landlords && data.landlords.length > 0) {
      await this.processLandlordAssignments(property.id, data.landlords, companyId, userId)
    }

    return { id: property.id }
  }

  // --------------------------------------------------------------------------
  // READ (List)
  // --------------------------------------------------------------------------

  async listProperties(
    companyId: string,
    filters: PropertyFilters
  ): Promise<{ properties: PropertyListItem[], pagination: { page: number, limit: number, total: number, totalPages: number } }> {
    const page = Math.max(1, filters.page || 1)
    const limit = Math.min(100, Math.max(1, filters.limit || 50))
    const offset = (page - 1) * limit

    // Build base query
    let query = supabase
      .from('properties')
      .select(`
        id, postcode, status, property_type, management_type, bills_included, is_licensed, created_at,
        full_address_encrypted, address_line1_encrypted, address_line2_encrypted,
        city_encrypted, county_encrypted,
        property_landlords (id),
        compliance_records (id, status, expiry_date)
      `, { count: 'exact' })
      .eq('company_id', companyId)
      .is('deleted_at', null)

    // Apply filters
    if (filters.status) {
      query = query.eq('status', filters.status)
    }

    if (filters.is_licensed !== undefined) {
      query = query.eq('is_licensed', filters.is_licensed)
    }

    // Apply postcode search directly in query only if search looks like a UK postcode
    // UK postcodes: start with 1-2 letters, then number(s), optionally space and more chars
    // Examples: B70, B700LX, SW1A 1AA, M1 1AA
    const searchTerm = filters.search || ''
    const normalizedForCheck = searchTerm.toUpperCase().replace(/\s/g, '')
    const isPostcodeLike = searchTerm && /^[A-Z]{1,2}[0-9][0-9A-Z]{0,4}$/.test(normalizedForCheck)
    if (isPostcodeLike) {
      const normalizedSearch = this.normalizePostcode(searchTerm)
      query = query.ilike('postcode', `%${normalizedSearch}%`)
    }

    // Sort
    const sortBy = filters.sortBy || 'created_at'
    const ascending = filters.sortOrder === 'asc'
    query = query.order(sortBy, { ascending })

    // Pagination
    query = query.range(offset, offset + limit - 1)

    const { data: properties, error, count } = await query

    if (error) {
      console.error('Failed to list properties:', error)
      throw new Error(`Failed to list properties: ${error.message}`)
    }

    // Format response with decryption
    let formattedProperties: PropertyListItem[] = (properties || []).map(p =>
      this.formatPropertyListItem(p)
    )

    // Apply post-fetch filters that require decryption
    // Search in decrypted address fields if search is not postcode-like
    if (searchTerm && !isPostcodeLike) {
      const searchLower = searchTerm.toLowerCase()
      formattedProperties = formattedProperties.filter(p =>
        p.address?.toLowerCase().includes(searchLower) ||
        p.address_line1?.toLowerCase().includes(searchLower) ||
        p.city?.toLowerCase().includes(searchLower)
      )
    }

    if (filters.has_landlord === false) {
      formattedProperties = formattedProperties.filter(p => p.landlord_count === 0)
    } else if (filters.has_landlord === true) {
      formattedProperties = formattedProperties.filter(p => p.landlord_count > 0)
    }

    if (filters.compliance_status) {
      formattedProperties = formattedProperties.filter(p =>
        p.compliance_status === filters.compliance_status
      )
    }

    return {
      properties: formattedProperties,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    }
  }

  // --------------------------------------------------------------------------
  // READ (Single)
  // --------------------------------------------------------------------------

  async getProperty(propertyId: string, companyId: string): Promise<PropertyDetail | null> {
    const { data: property, error } = await supabase
      .from('properties')
      .select(`
        *,
        property_landlords (
          id, ownership_percentage, is_primary_contact, landlord_id,
          landlords (id, first_name_encrypted, last_name_encrypted, email_encrypted)
        ),
        compliance_records (
          id, compliance_type, custom_type_name, issue_date, expiry_date, status,
          certificate_number, issuer_name,
          compliance_documents (id, file_name, file_path, file_size, file_type, is_current, uploaded_at)
        ),
        property_tenancies (
          id, is_active, reference_id,
          tenant_references (
            id, tenant_first_name_encrypted, tenant_last_name_encrypted, status
          )
        ),
        property_documents (
          id, file_name, file_path, file_size, file_type, tag, custom_tag_name, uploaded_at, description
        )
      `)
      .eq('id', propertyId)
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null // Not found
      }
      console.error('Failed to get property:', error)
      throw new Error(`Failed to get property: ${error.message}`)
    }

    return this.formatPropertyDetail(property)
  }

  // --------------------------------------------------------------------------
  // UPDATE
  // --------------------------------------------------------------------------

  async updateProperty(
    propertyId: string,
    data: Partial<PropertyData>,
    companyId: string,
    userId: string
  ): Promise<void> {
    // Verify ownership
    const existing = await this.getProperty(propertyId, companyId)
    if (!existing) {
      throw new Error('Property not found')
    }

    // Build update data
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString()
    }

    if (data.address) {
      if (data.address.full_address !== undefined) {
        updateData.full_address_encrypted = data.address.full_address ? encrypt(data.address.full_address) : null
      }
      if (data.address.line1 !== undefined) {
        updateData.address_line1_encrypted = data.address.line1 ? encrypt(data.address.line1) : null
      }
      if (data.address.line2 !== undefined) {
        updateData.address_line2_encrypted = data.address.line2 ? encrypt(data.address.line2) : null
      }
      if (data.address.city !== undefined) {
        updateData.city_encrypted = data.address.city ? encrypt(data.address.city) : null
      }
      if (data.address.county !== undefined) {
        updateData.county_encrypted = data.address.county ? encrypt(data.address.county) : null
      }
      if (data.address.postcode) {
        updateData.postcode = this.normalizePostcode(data.address.postcode)
      }
      if (data.address.country !== undefined) {
        updateData.country = data.address.country || 'GB'
      }
    }

    if (data.property_type !== undefined) updateData.property_type = data.property_type
    if (data.number_of_bedrooms !== undefined) updateData.number_of_bedrooms = data.number_of_bedrooms
    if (data.number_of_bathrooms !== undefined) updateData.number_of_bathrooms = data.number_of_bathrooms
    if (data.furnishing_status !== undefined) updateData.furnishing_status = data.furnishing_status
    if (data.management_type !== undefined) updateData.management_type = data.management_type
    if (data.bills_included !== undefined) updateData.bills_included = data.bills_included
    if (data.is_licensed !== undefined) updateData.is_licensed = data.is_licensed
    if (data.license_number !== undefined) updateData.license_number = data.license_number
    if (data.license_expiry_date !== undefined) updateData.license_expiry_date = data.license_expiry_date
    if (data.license_authority !== undefined) updateData.license_authority = data.license_authority
    if (data.notes !== undefined) updateData.notes_encrypted = data.notes ? encrypt(data.notes) : null

    const { error } = await supabase
      .from('properties')
      .update(updateData)
      .eq('id', propertyId)
      .eq('company_id', companyId)

    if (error) {
      console.error('Failed to update property:', error)
      throw new Error(`Failed to update property: ${error.message}`)
    }
  }

  // --------------------------------------------------------------------------
  // DELETE (Soft)
  // --------------------------------------------------------------------------

  async deleteProperty(
    propertyId: string,
    companyId: string,
    userId: string
  ): Promise<void> {
    const { error } = await supabase
      .from('properties')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: userId
      })
      .eq('id', propertyId)
      .eq('company_id', companyId)

    if (error) {
      console.error('Failed to delete property:', error)
      throw new Error(`Failed to delete property: ${error.message}`)
    }
  }

  // --------------------------------------------------------------------------
  // LANDLORD MANAGEMENT
  // --------------------------------------------------------------------------

  async updatePropertyLandlords(
    propertyId: string,
    landlords: LandlordAssignment[],
    companyId: string,
    userId: string
  ): Promise<void> {
    // Validate total ownership
    const totalOwnership = landlords.reduce((sum, l) => sum + (l.ownership_percentage || 0), 0)
    if (landlords.length > 0 && Math.abs(totalOwnership - 100) > 0.01) {
      throw new Error(`Total ownership percentage must equal 100% (currently ${totalOwnership}%)`)
    }

    // Delete existing landlord links
    await supabase
      .from('property_landlords')
      .delete()
      .eq('property_id', propertyId)

    // Add new landlord links
    if (landlords.length > 0) {
      await this.processLandlordAssignments(propertyId, landlords, companyId, userId)
    }
  }

  // --------------------------------------------------------------------------
  // COMPLIANCE
  // --------------------------------------------------------------------------

  async addComplianceRecord(
    propertyId: string,
    data: ComplianceData,
    companyId: string,
    userId: string
  ): Promise<{ id: string }> {
    // Calculate expiry if not provided
    let expiryDate = data.expiry_date
    if (!expiryDate) {
      expiryDate = this.calculateDefaultExpiry(data.compliance_type, data.issue_date)
    }

    const complianceData = {
      property_id: propertyId,
      company_id: companyId,
      compliance_type: data.compliance_type,
      custom_type_name: data.custom_type_name || null,
      issue_date: data.issue_date,
      expiry_date: expiryDate,
      expiry_date_overridden: !!data.expiry_date,
      certificate_number: data.certificate_number || null,
      issuer_name: data.issuer_name || null,
      issuer_company: data.issuer_company || null,
      notes: data.notes || null,
      created_by: userId
    }

    const { data: compliance, error } = await supabase
      .from('compliance_records')
      .insert(complianceData)
      .select('id')
      .single()

    if (error) {
      console.error('Failed to add compliance record:', error)
      throw new Error(`Failed to add compliance record: ${error.message}`)
    }

    return { id: compliance.id }
  }

  async getComplianceRecords(propertyId: string, companyId: string) {
    const { data, error } = await supabase
      .from('compliance_records')
      .select(`
        *,
        compliance_documents (id, file_name, file_path, is_current)
      `)
      .eq('property_id', propertyId)
      .eq('company_id', companyId)
      .order('expiry_date', { ascending: true })

    if (error) {
      console.error('Failed to get compliance records:', error)
      throw new Error(`Failed to get compliance records: ${error.message}`)
    }

    return data || []
  }

  async updateComplianceRecord(
    complianceId: string,
    data: Partial<ComplianceData>,
    companyId: string
  ): Promise<void> {
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString()
    }

    if (data.compliance_type) updateData.compliance_type = data.compliance_type
    if (data.custom_type_name !== undefined) updateData.custom_type_name = data.custom_type_name
    if (data.issue_date) updateData.issue_date = data.issue_date
    if (data.expiry_date) {
      updateData.expiry_date = data.expiry_date
      updateData.expiry_date_overridden = true
    }
    if (data.certificate_number !== undefined) updateData.certificate_number = data.certificate_number
    if (data.issuer_name !== undefined) updateData.issuer_name = data.issuer_name
    if (data.issuer_company !== undefined) updateData.issuer_company = data.issuer_company
    if (data.notes !== undefined) updateData.notes = data.notes

    const { error } = await supabase
      .from('compliance_records')
      .update(updateData)
      .eq('id', complianceId)
      .eq('company_id', companyId)

    if (error) {
      console.error('Failed to update compliance record:', error)
      throw new Error(`Failed to update compliance record: ${error.message}`)
    }
  }

  async deleteComplianceRecord(complianceId: string, companyId: string): Promise<void> {
    const { error } = await supabase
      .from('compliance_records')
      .delete()
      .eq('id', complianceId)
      .eq('company_id', companyId)

    if (error) {
      console.error('Failed to delete compliance record:', error)
      throw new Error(`Failed to delete compliance record: ${error.message}`)
    }
  }

  async getComplianceStatus(propertyId: string, companyId: string): Promise<{
    hasExpiredCompliance: boolean
    hasExpiringCompliance: boolean
    items: Array<{
      type: string
      status: string
      expiry_date: string | null
      days_until_expiry: number | null
    }>
  }> {
    const records = await this.getComplianceRecords(propertyId, companyId)

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const items = records.map(r => {
      const expiryDate = r.expiry_date ? new Date(r.expiry_date) : null
      let daysUntilExpiry: number | null = null

      if (expiryDate) {
        daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      }

      return {
        type: r.compliance_type,
        status: r.status,
        expiry_date: r.expiry_date,
        days_until_expiry: daysUntilExpiry
      }
    })

    return {
      hasExpiredCompliance: items.some(i => i.status === 'expired'),
      hasExpiringCompliance: items.some(i => i.status === 'expiring_soon'),
      items
    }
  }

  // --------------------------------------------------------------------------
  // DOCUMENTS
  // --------------------------------------------------------------------------

  async getPropertyDocuments(propertyId: string, tag?: string) {
    let query = supabase
      .from('property_documents')
      .select('*')
      .eq('property_id', propertyId)
      .order('uploaded_at', { ascending: false })

    if (tag) {
      query = query.eq('tag', tag)
    }

    const { data, error } = await query

    if (error) {
      console.error('Failed to get property documents:', error)
      throw new Error(`Failed to get property documents: ${error.message}`)
    }

    return data || []
  }

  async addPropertyDocument(
    propertyId: string,
    data: {
      file_name: string
      file_path: string
      file_size?: number
      file_type?: string
      tag: string
      custom_tag_name?: string
      source_type?: string
      source_id?: string
      description?: string
    },
    userId: string
  ): Promise<{ id: string }> {
    const { data: doc, error } = await supabase
      .from('property_documents')
      .insert({
        property_id: propertyId,
        file_name: data.file_name,
        file_path: data.file_path,
        file_size: data.file_size || null,
        file_type: data.file_type || null,
        tag: data.tag,
        custom_tag_name: data.custom_tag_name || null,
        source_type: data.source_type || 'direct_upload',
        source_id: data.source_id || null,
        description: data.description || null,
        uploaded_by: userId
      })
      .select('id')
      .single()

    if (error) {
      console.error('Failed to add property document:', error)
      throw new Error(`Failed to add property document: ${error.message}`)
    }

    return { id: doc.id }
  }

  async removePropertyDocument(documentId: string, propertyId: string): Promise<void> {
    // Only removes the association, not the actual file
    const { error } = await supabase
      .from('property_documents')
      .delete()
      .eq('id', documentId)
      .eq('property_id', propertyId)

    if (error) {
      console.error('Failed to remove property document:', error)
      throw new Error(`Failed to remove property document: ${error.message}`)
    }
  }

  // --------------------------------------------------------------------------
  // STATS
  // --------------------------------------------------------------------------

  async getPropertyStats(companyId: string): Promise<{
    total: number
    vacant: number
    inTenancy: number
    complianceIssues: number
  }> {
    // Get total count
    const { count: total } = await supabase
      .from('properties')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .is('deleted_at', null)

    // Get vacant count
    const { count: vacant } = await supabase
      .from('properties')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('status', 'vacant')
      .is('deleted_at', null)

    // Get in_tenancy count
    const { count: inTenancy } = await supabase
      .from('properties')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('status', 'in_tenancy')
      .is('deleted_at', null)

    // Get compliance issues (expired or expiring soon)
    const { count: complianceIssues } = await supabase
      .from('compliance_records')
      .select('property_id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .in('status', ['expired', 'expiring_soon'])

    return {
      total: total || 0,
      vacant: vacant || 0,
      inTenancy: inTenancy || 0,
      complianceIssues: complianceIssues || 0
    }
  }

  // --------------------------------------------------------------------------
  // PRIVATE HELPER METHODS
  // --------------------------------------------------------------------------

  private async processLandlordAssignments(
    propertyId: string,
    landlords: LandlordAssignment[],
    companyId: string,
    userId: string
  ): Promise<void> {
    for (const landlord of landlords) {
      let landlordId = landlord.landlord_id

      // Create new landlord if requested
      if (landlord.create_new && !landlordId) {
        if (!landlord.first_name || !landlord.last_name || !landlord.email) {
          throw new Error('First name, last name, and email are required when creating a new landlord')
        }

        const { data: newLandlord, error } = await supabase
          .from('landlords')
          .insert({
            company_id: companyId,
            first_name_encrypted: encrypt(landlord.first_name),
            last_name_encrypted: encrypt(landlord.last_name),
            email_encrypted: encrypt(landlord.email),
            phone_encrypted: landlord.phone ? encrypt(landlord.phone) : null,
            created_by: userId
          })
          .select('id')
          .single()

        if (error) {
          console.error('Failed to create landlord:', error)
          throw new Error(`Failed to create landlord: ${error.message}`)
        }
        landlordId = newLandlord.id
      }

      if (!landlordId) {
        throw new Error('Landlord ID is required')
      }

      // Link landlord to property
      const { error } = await supabase
        .from('property_landlords')
        .insert({
          property_id: propertyId,
          landlord_id: landlordId,
          ownership_percentage: landlord.ownership_percentage,
          is_primary_contact: landlord.is_primary_contact || false,
          created_by: userId
        })

      if (error) {
        console.error('Failed to link landlord to property:', error)
        throw new Error(`Failed to link landlord to property: ${error.message}`)
      }
    }
  }

  private normalizePostcode(postcode: string): string {
    return postcode.toUpperCase().replace(/\s/g, '')
  }

  private calculateDefaultExpiry(complianceType: string, issueDate: string): string {
    const issue = new Date(issueDate)
    let years = 1

    switch (complianceType) {
      case 'gas_safety': years = 1; break
      case 'eicr': years = 5; break
      case 'epc': years = 10; break
      case 'pat_test': years = 1; break
      case 'legionella': years = 2; break
      default: years = 1
    }

    issue.setFullYear(issue.getFullYear() + years)
    return issue.toISOString().split('T')[0]
  }

  private formatPropertyListItem(property: any): PropertyListItem {
    const complianceRecords = property.compliance_records || []

    // Determine compliance status
    let complianceStatus: 'valid' | 'expiring_soon' | 'expired' | 'none' = 'none'
    let nextExpiryDate: string | null = null

    if (complianceRecords.length > 0) {
      const hasExpired = complianceRecords.some((c: any) => c.status === 'expired')
      const hasExpiring = complianceRecords.some((c: any) => c.status === 'expiring_soon')

      if (hasExpired) {
        complianceStatus = 'expired'
      } else if (hasExpiring) {
        complianceStatus = 'expiring_soon'
      } else {
        complianceStatus = 'valid'
      }

      // Find next expiry date
      const sortedRecords = [...complianceRecords].sort((a: any, b: any) =>
        new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime()
      )
      nextExpiryDate = sortedRecords[0]?.expiry_date || null
    }

    const addressLine1 = decrypt(property.address_line1_encrypted)
    const addressLine2 = decrypt(property.address_line2_encrypted)
    const city = decrypt(property.city_encrypted)
    const county = decrypt(property.county_encrypted)
    const fullAddress = decrypt(property.full_address_encrypted)

    return {
      id: property.id,
      address: fullAddress || addressLine1,
      address_line1: addressLine1,
      address_line2: addressLine2,
      city: city,
      county: county,
      postcode: property.postcode,
      status: property.status,
      property_type: property.property_type,
      management_type: property.management_type,
      bills_included: property.bills_included || false,
      is_licensed: property.is_licensed,
      landlord_count: property.property_landlords?.length || 0,
      compliance_status: complianceStatus,
      next_expiry_date: nextExpiryDate,
      created_at: property.created_at
    }
  }

  private complianceTypeToDocTag(complianceType: string): string {
    const mapping: Record<string, string> = {
      'gas_safety': 'gas',
      'eicr': 'epc',  // Electrical goes under EPC tag for now
      'epc': 'epc',
      'council_licence': 'other',
      'pat_test': 'other',
      'other': 'other'
    }
    return mapping[complianceType] || 'other'
  }

  private formatComplianceTypeName(complianceType: string): string {
    const names: Record<string, string> = {
      'gas_safety': 'Gas Safety',
      'eicr': 'EICR',
      'epc': 'EPC',
      'council_licence': 'Council Licence',
      'pat_test': 'PAT Test',
      'other': 'Other'
    }
    return names[complianceType] || complianceType
  }

  private formatPropertyDetail(property: any): PropertyDetail {
    // Build formatted address
    const fullAddress = decrypt(property.full_address_encrypted)
    const line1 = decrypt(property.address_line1_encrypted)
    const line2 = decrypt(property.address_line2_encrypted)
    const city = decrypt(property.city_encrypted)
    const county = decrypt(property.county_encrypted)

    let formatted = fullAddress
    if (!formatted) {
      const parts = [line1, line2, city, county, property.postcode].filter(Boolean)
      formatted = parts.join(', ')
    }

    return {
      id: property.id,
      address: {
        full_address: fullAddress || undefined,
        line1: line1 || undefined,
        line2: line2 || undefined,
        city: city || undefined,
        county: county || undefined,
        postcode: property.postcode,
        country: property.country,
        formatted
      },
      property_type: property.property_type,
      number_of_bedrooms: property.number_of_bedrooms,
      number_of_bathrooms: property.number_of_bathrooms,
      furnishing_status: property.furnishing_status,
      management_type: property.management_type,
      bills_included: property.bills_included || false,
      status: property.status,
      status_override: property.status_override,
      is_licensed: property.is_licensed,
      license_number: property.license_number,
      license_expiry_date: property.license_expiry_date,
      notes: decrypt(property.notes_encrypted),
      landlords: (property.property_landlords || []).map((pl: any) => ({
        id: pl.id,
        landlord_id: pl.landlord_id,
        name: [
          decrypt(pl.landlords?.first_name_encrypted),
          decrypt(pl.landlords?.last_name_encrypted)
        ].filter(Boolean).join(' '),
        email: decrypt(pl.landlords?.email_encrypted),
        ownership_percentage: pl.ownership_percentage,
        is_primary_contact: pl.is_primary_contact
      })),
      compliance: (property.compliance_records || []).map((c: any) => ({
        id: c.id,
        compliance_type: c.compliance_type,
        custom_type_name: c.custom_type_name,
        issue_date: c.issue_date,
        expiry_date: c.expiry_date,
        status: c.status,
        certificate_number: c.certificate_number,
        issuer_name: c.issuer_name,
        documents: (c.compliance_documents || []).filter((d: any) => d.is_current).map((d: any) => ({
          id: d.id,
          file_name: d.file_name,
          file_path: d.file_path,
          is_current: d.is_current
        }))
      })),
      tenancies: (property.property_tenancies || []).map((pt: any) => ({
        id: pt.id,
        reference_id: pt.reference_id,
        tenant_name: [
          decrypt(pt.tenant_references?.tenant_first_name_encrypted),
          decrypt(pt.tenant_references?.tenant_last_name_encrypted)
        ].filter(Boolean).join(' '),
        status: pt.tenant_references?.status,
        is_active: pt.is_active
      })),
      documents: [
        // Property documents
        ...(property.property_documents || []).map((d: any) => ({
          id: d.id,
          file_name: d.file_name,
          file_path: d.file_path,
          file_size: d.file_size,
          file_type: d.file_type,
          tag: d.tag,
          uploaded_at: d.uploaded_at,
          description: d.description,
          source: 'property' as const
        })),
        // Compliance documents (merged with appropriate tags)
        ...(property.compliance_records || []).flatMap((c: any) =>
          (c.compliance_documents || []).filter((d: any) => d.is_current).map((d: any) => ({
            id: d.id,
            file_name: d.file_name,
            file_path: d.file_path,
            file_size: d.file_size,
            file_type: d.file_type,
            tag: this.complianceTypeToDocTag(c.compliance_type),
            uploaded_at: d.uploaded_at,
            description: `${this.formatComplianceTypeName(c.compliance_type)} Certificate`,
            source: 'compliance' as const,
            compliance_record_id: c.id
          }))
        )
      ],
      created_at: property.created_at,
      updated_at: property.updated_at
    }
  }
}

export const propertyService = new PropertyService()
