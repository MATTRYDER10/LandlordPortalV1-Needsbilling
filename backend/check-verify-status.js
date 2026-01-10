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

async function checkVerifyStatus() {
  console.log('=== CHECKING VERIFY STATUS FOR CORRUPTED EMPLOYER REFERENCES ===\n');

  // Find all employer references that need to be resent (submitted_at = null)
  const { data: employerRefs } = await supabase
    .from('employer_references')
    .select('id, reference_id')
    .is('submitted_at', null)
    .not('reference_token_hash', 'is', null);

  console.log(`Found ${employerRefs?.length || 0} employer references to check\n`);

  const statusBreakdown = {
    COMPLETED: [],
    IN_PROGRESS: [],
    AVAILABLE: [],
    PENDING: [],
    OTHER: []
  };

  for (const empRef of employerRefs || []) {
    // Get tenant reference details
    const { data: tenantRef } = await supabase
      .from('tenant_references')
      .select('id, tenant_first_name_encrypted, tenant_last_name_encrypted, property_address_encrypted')
      .eq('id', empRef.reference_id)
      .single();

    // Get verify work item
    const { data: workItem } = await supabase
      .from('work_items')
      .select('id, status, work_type')
      .eq('reference_id', empRef.reference_id)
      .eq('work_type', 'VERIFY')
      .maybeSingle();

    const tenantName = tenantRef ? `${decrypt(tenantRef.tenant_first_name_encrypted)} ${decrypt(tenantRef.tenant_last_name_encrypted)}` : 'Unknown';
    const property = tenantRef ? decrypt(tenantRef.property_address_encrypted) : 'Unknown';

    const status = workItem?.status || 'NO_WORK_ITEM';

    const info = {
      referenceId: empRef.reference_id,
      tenantName,
      property,
      workItemStatus: status,
      workItemId: workItem?.id
    };

    if (status === 'COMPLETED') {
      statusBreakdown.COMPLETED.push(info);
    } else if (status === 'IN_PROGRESS') {
      statusBreakdown.IN_PROGRESS.push(info);
    } else if (status === 'AVAILABLE') {
      statusBreakdown.AVAILABLE.push(info);
    } else if (status === 'PENDING') {
      statusBreakdown.PENDING.push(info);
    } else {
      statusBreakdown.OTHER.push(info);
    }
  }

  console.log('=== STATUS BREAKDOWN ===\n');

  console.log(`✅ COMPLETED (${statusBreakdown.COMPLETED.length}) - Already verified, no action needed:`);
  statusBreakdown.COMPLETED.forEach(item => {
    console.log(`   - ${item.tenantName} - ${item.property}`);
  });
  console.log('');

  console.log(`🔄 IN_PROGRESS (${statusBreakdown.IN_PROGRESS.length}) - Currently being verified:`);
  statusBreakdown.IN_PROGRESS.forEach(item => {
    console.log(`   - ${item.tenantName} - ${item.property} (Work Item: ${item.workItemId})`);
  });
  console.log('');

  console.log(`📋 AVAILABLE (${statusBreakdown.AVAILABLE.length}) - In queue, need to update status:`);
  statusBreakdown.AVAILABLE.forEach(item => {
    console.log(`   - ${item.tenantName} - ${item.property} (Work Item: ${item.workItemId})`);
  });
  console.log('');

  console.log(`⏸️  PENDING (${statusBreakdown.PENDING.length}) - Already pending:`);
  statusBreakdown.PENDING.forEach(item => {
    console.log(`   - ${item.tenantName} - ${item.property} (Work Item: ${item.workItemId})`);
  });
  console.log('');

  console.log(`❓ OTHER (${statusBreakdown.OTHER.length}) - Other status or no work item:`);
  statusBreakdown.OTHER.forEach(item => {
    console.log(`   - ${item.tenantName} - ${item.property} (Status: ${item.workItemStatus})`);
  });
  console.log('');

  console.log('=== SUMMARY ===');
  console.log(`Total: ${employerRefs?.length || 0}`);
  console.log(`Already verified (no action): ${statusBreakdown.COMPLETED.length}`);
  console.log(`Need status update: ${statusBreakdown.AVAILABLE.length + statusBreakdown.IN_PROGRESS.length}`);

  // Return list of work items that need status update
  const needsUpdate = [...statusBreakdown.AVAILABLE, ...statusBreakdown.IN_PROGRESS];

  if (needsUpdate.length > 0) {
    console.log(`\n=== WORK ITEMS TO UPDATE TO "PENDING" ===`);
    needsUpdate.forEach(item => {
      console.log(`Work Item ID: ${item.workItemId} - ${item.tenantName}`);
    });
  }

  process.exit(0);
}

checkVerifyStatus();
