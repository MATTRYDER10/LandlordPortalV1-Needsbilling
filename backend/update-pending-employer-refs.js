const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const TAG_POSITION = SALT_LENGTH + IV_LENGTH;
const ENCRYPTED_POSITION = TAG_POSITION + TAG_LENGTH;

function decrypt(encryptedData) {
  if (!encryptedData) return null;
  const key = Buffer.from(process.env.ENCRYPTION_KEY, 'base64');
  const combined = Buffer.from(encryptedData, 'base64');
  const salt = combined.subarray(0, SALT_LENGTH);
  const iv = combined.subarray(SALT_LENGTH, TAG_POSITION);
  const tag = combined.subarray(TAG_POSITION, ENCRYPTED_POSITION);
  const encrypted = combined.subarray(ENCRYPTED_POSITION);

  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  } catch (e1) {
    try {
      const derivedKey = crypto.pbkdf2Sync(key, salt, 10000, 32, 'sha512');
      const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
    } catch (e2) {
      try {
        const derivedKey = crypto.pbkdf2Sync(key, salt, 100000, 32, 'sha512');
        const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
      } catch (e3) {
        return null;
      }
    }
  }
}

async function updatePendingEmployerRefs() {
  console.log('=== UPDATING WORK ITEMS FOR INCOMPLETE EMPLOYER REFERENCES ===\n');

  // Find all employer references that need to be resent
  const { data: employerRefs } = await supabase
    .from('employer_references')
    .select('id, reference_id')
    .is('submitted_at', null)
    .not('reference_token_hash', 'is', null);

  console.log(`Found ${employerRefs?.length || 0} employer references to check\n`);

  let updatedCount = 0;
  let skippedCompleted = 0;
  let createdCount = 0;

  for (const empRef of employerRefs || []) {
    // Get tenant reference details
    const { data: tenantRef } = await supabase
      .from('tenant_references')
      .select('id, tenant_first_name_encrypted, tenant_last_name_encrypted, property_address_encrypted')
      .eq('id', empRef.reference_id)
      .single();

    const tenantName = tenantRef ? `${decrypt(tenantRef.tenant_first_name_encrypted)} ${decrypt(tenantRef.tenant_last_name_encrypted)}` : 'Unknown';
    const property = tenantRef ? decrypt(tenantRef.property_address_encrypted) : 'Unknown';

    // Get verify work item
    const { data: workItem } = await supabase
      .from('work_items')
      .select('id, status, work_type, assigned_to')
      .eq('reference_id', empRef.reference_id)
      .eq('work_type', 'VERIFY')
      .maybeSingle();

    // Skip if already completed
    if (workItem?.status === 'COMPLETED') {
      console.log(`✅ SKIPPED (already verified): ${tenantName} - ${property}`);
      skippedCompleted++;
      continue;
    }

    // If no work item, create one with RETURNED status
    if (!workItem) {
      const { error: createError } = await supabase
        .from('work_items')
        .upsert({
          reference_id: empRef.reference_id,
          work_type: 'VERIFY',
          status: 'RETURNED',
          priority: 0
        }, {
          onConflict: 'reference_id,work_type',
          ignoreDuplicates: false
        });

      if (createError) {
        console.log(`❌ FAILED to create work item: ${tenantName} - ${property}:`, createError.message);
      } else {
        console.log(`✨ CREATED RETURNED work item: ${tenantName} - ${property}`);
        createdCount++;
      }
      continue;
    }

    // Update work item to RETURNED (and unassign if assigned)
    const updateData = {
      status: 'RETURNED'
    };

    // If it was assigned, unassign it
    if (workItem.assigned_to) {
      updateData.assigned_to = null;
    }

    const { error: updateError } = await supabase
      .from('work_items')
      .update(updateData)
      .eq('id', workItem.id);

    if (updateError) {
      console.log(`❌ FAILED: ${tenantName} - ${property}:`, updateError.message);
    } else {
      const wasAssigned = workItem.assigned_to ? ' (unassigned)' : '';
      console.log(`🔄 UPDATED to RETURNED: ${tenantName} - ${property} (was ${workItem.status})${wasAssigned}`);
      updatedCount++;
    }
  }

  console.log('\n=== SUMMARY ===');
  console.log(`Total employer refs pending: ${employerRefs?.length || 0}`);
  console.log(`Skipped (already verified): ${skippedCompleted}`);
  console.log(`Updated to RETURNED: ${updatedCount}`);
  console.log(`Created RETURNED work items: ${createdCount}`);

  process.exit(0);
}

updatePendingEmployerRefs();
