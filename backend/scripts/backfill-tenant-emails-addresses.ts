/**
 * Backfill tenant emails and addresses from references to tenancy_tenants
 * This ensures existing tenancies have all tenant data persisted
 */
import { supabase } from '../src/config/supabase'
import { encrypt, decrypt } from '../src/services/encryption'

async function backfillTenantData() {
  console.log('Starting tenant data backfill...')

  // Get all tenancy_tenants that have a reference_id but might be missing email/address
  const { data: tenancyTenants, error } = await supabase
    .from('tenancy_tenants')
    .select('id, tenant_reference_id, tenant_email_encrypted, residential_address_line1_encrypted')
    .not('tenant_reference_id', 'is', null)

  if (error) {
    console.error('Failed to fetch tenancy_tenants:', error)
    return
  }

  console.log(`Found ${tenancyTenants?.length || 0} tenancy_tenants with references`)

  let updatedEmails = 0
  let updatedAddresses = 0

  for (const tt of tenancyTenants || []) {
    // Check if we need to update email or address
    const needsEmail = !tt.tenant_email_encrypted
    const needsAddress = !tt.residential_address_line1_encrypted

    if (!needsEmail && !needsAddress) {
      continue // Already has both
    }

    // Fetch reference data
    // Note: tenant_references uses current_* columns, tenancy_tenants uses residential_* columns
    const { data: ref } = await supabase
      .from('tenant_references')
      .select('tenant_email_encrypted, current_address_line1_encrypted, current_city_encrypted, current_postcode_encrypted')
      .eq('id', tt.tenant_reference_id)
      .single()

    if (!ref) {
      console.log(`No reference found for ${tt.tenant_reference_id}`)
      continue
    }

    const updateData: Record<string, any> = {}

    // Copy email if missing
    if (needsEmail && ref.tenant_email_encrypted) {
      updateData.tenant_email_encrypted = ref.tenant_email_encrypted
      updatedEmails++
    }

    // Copy address if missing (from current_* to residential_*)
    if (needsAddress && ref.current_address_line1_encrypted) {
      updateData.residential_address_line1_encrypted = ref.current_address_line1_encrypted
      updateData.residential_city_encrypted = ref.current_city_encrypted
      updateData.residential_postcode_encrypted = ref.current_postcode_encrypted
    }

    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabase
        .from('tenancy_tenants')
        .update(updateData)
        .eq('id', tt.id)

      if (updateError) {
        console.error(`Failed to update tenant ${tt.id}:`, updateError)
      } else {
        if (updateData.residential_address_line1_encrypted) {
          updatedAddresses++
        }
        console.log(`Updated tenant ${tt.id}`)
      }
    }
  }

  console.log(`Done! Updated ${updatedEmails} emails and ${updatedAddresses} addresses`)
}

backfillTenantData().catch(console.error)
