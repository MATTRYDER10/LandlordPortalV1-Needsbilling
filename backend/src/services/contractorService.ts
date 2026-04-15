import { supabase } from '../config/supabase'
import { encrypt, decrypt } from './encryption'

export interface Contractor {
  id: string
  company_id: string
  name: string
  company_name: string | null
  email: string | null
  phone: string | null
  bank_details: {
    account_name: string | null
    account_number: string | null
    sort_code: string | null
  }
  commission_percent: number
  commission_vat: boolean
  pi_policy_number: string | null
  pi_expiry_date: string | null
  pli_policy_number: string | null
  pli_expiry_date: string | null
  pli_certificate_url: string | null
  documents: any[]
  notes: string | null
  created_at: string
  updated_at: string
}

export interface CreateContractorInput {
  name: string
  company_name?: string
  email?: string
  phone?: string
  bank_account_name?: string
  bank_account_number?: string
  bank_sort_code?: string
  commission_percent: number
  commission_vat?: boolean
  notes?: string
}

function mapContractor(row: any): Contractor {
  return {
    id: row.id,
    company_id: row.company_id,
    name: row.name,
    company_name: row.company_name,
    email: row.email,
    phone: row.phone,
    bank_details: {
      account_name: row.bank_account_name_encrypted ? decrypt(row.bank_account_name_encrypted) : null,
      account_number: row.bank_account_number_encrypted ? decrypt(row.bank_account_number_encrypted) : null,
      sort_code: row.bank_sort_code_encrypted ? decrypt(row.bank_sort_code_encrypted) : null,
    },
    commission_percent: parseFloat(row.commission_percent) || 0,
    commission_vat: row.commission_vat || false,
    pi_policy_number: row.pi_policy_number || null,
    pi_expiry_date: row.pi_expiry_date || null,
    pli_policy_number: row.pli_policy_number || null,
    pli_expiry_date: row.pli_expiry_date || null,
    pli_certificate_url: row.pli_certificate_url || null,
    documents: row.contractor_documents || [],
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export async function listContractors(companyId: string, includeArchived = false): Promise<Contractor[]> {
  let query = supabase
    .from('contractors')
    .select('*, contractor_documents(*)')
    .eq('company_id', companyId)
    .order('name', { ascending: true })

  if (!includeArchived) {
    query = query.is('archived_at', null)
  }

  const { data, error } = await query
  if (error) throw error
  return (data || []).map(c => ({
    ...mapContractor(c),
    documents: c.contractor_documents || [],
    archived_at: c.archived_at || null
  }))
}

export async function getContractor(id: string, companyId: string): Promise<Contractor | null> {
  const { data, error } = await supabase
    .from('contractors')
    .select('*')
    .eq('id', id)
    .eq('company_id', companyId)
    .single()

  if (error) return null
  return mapContractor(data)
}

export async function createContractor(companyId: string, input: CreateContractorInput): Promise<Contractor> {
  const insertData: any = {
    company_id: companyId,
    name: input.name,
    company_name: input.company_name || null,
    email: input.email || null,
    phone: input.phone || null,
    commission_percent: input.commission_percent,
    commission_vat: input.commission_vat || false,
    notes: input.notes || null,
  }

  if (input.bank_account_name) insertData.bank_account_name_encrypted = encrypt(input.bank_account_name)
  if (input.bank_account_number) insertData.bank_account_number_encrypted = encrypt(input.bank_account_number)
  if (input.bank_sort_code) insertData.bank_sort_code_encrypted = encrypt(input.bank_sort_code)
  if ((input as any).pi_policy_number) insertData.pi_policy_number = (input as any).pi_policy_number
  if ((input as any).pi_expiry_date) insertData.pi_expiry_date = (input as any).pi_expiry_date
  if ((input as any).pli_policy_number) insertData.pli_policy_number = (input as any).pli_policy_number
  if ((input as any).pli_expiry_date) insertData.pli_expiry_date = (input as any).pli_expiry_date

  const { data, error } = await supabase
    .from('contractors')
    .insert(insertData)
    .select()
    .single()

  if (error) throw error
  return mapContractor(data)
}

export async function updateContractor(id: string, companyId: string, input: Partial<CreateContractorInput>): Promise<Contractor> {
  const updateData: any = { updated_at: new Date().toISOString() }

  if (input.name !== undefined) updateData.name = input.name
  if (input.company_name !== undefined) updateData.company_name = input.company_name
  if (input.email !== undefined) updateData.email = input.email
  if (input.phone !== undefined) updateData.phone = input.phone
  if (input.commission_percent !== undefined) updateData.commission_percent = input.commission_percent
  if (input.commission_vat !== undefined) updateData.commission_vat = input.commission_vat
  if (input.notes !== undefined) updateData.notes = input.notes
  if (input.bank_account_name !== undefined) updateData.bank_account_name_encrypted = input.bank_account_name ? encrypt(input.bank_account_name) : null
  if (input.bank_account_number !== undefined) updateData.bank_account_number_encrypted = input.bank_account_number ? encrypt(input.bank_account_number) : null
  if (input.bank_sort_code !== undefined) updateData.bank_sort_code_encrypted = input.bank_sort_code ? encrypt(input.bank_sort_code) : null
  if ((input as any).pi_policy_number !== undefined) updateData.pi_policy_number = (input as any).pi_policy_number
  if ((input as any).pi_expiry_date !== undefined) updateData.pi_expiry_date = (input as any).pi_expiry_date
  if ((input as any).pli_policy_number !== undefined) updateData.pli_policy_number = (input as any).pli_policy_number
  if ((input as any).pli_expiry_date !== undefined) updateData.pli_expiry_date = (input as any).pli_expiry_date

  const { data, error } = await supabase
    .from('contractors')
    .update(updateData)
    .eq('id', id)
    .eq('company_id', companyId)
    .select()
    .single()

  if (error) throw error
  return mapContractor(data)
}

export async function deleteContractor(id: string, companyId: string): Promise<{ deleted: boolean; archived: boolean }> {
  // Check if contractor has any invoices
  const { data: invoices } = await supabase
    .from('contractor_invoices')
    .select('id')
    .eq('contractor_id', id)
    .eq('company_id', companyId)
    .limit(1)

  if (invoices && invoices.length > 0) {
    // Has history — archive instead of delete
    const { error } = await supabase
      .from('contractors')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', id)
      .eq('company_id', companyId)

    if (error) throw error
    return { deleted: false, archived: true }
  }

  // No history — safe to hard delete
  const { error } = await supabase
    .from('contractors')
    .delete()
    .eq('id', id)
    .eq('company_id', companyId)

  if (error) throw error
  return { deleted: true, archived: false }
}

export async function restoreContractor(id: string, companyId: string): Promise<void> {
  const { error } = await supabase
    .from('contractors')
    .update({ archived_at: null })
    .eq('id', id)
    .eq('company_id', companyId)

  if (error) throw error
}
