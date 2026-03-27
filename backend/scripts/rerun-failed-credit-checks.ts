/**
 * Re-run failed credit checks after Creditsafe account fix
 *
 * Usage: npx ts-node scripts/rerun-failed-credit-checks.ts
 *
 * This script finds all credit checks that failed with "error" status
 * and re-runs them. Handles both V1 and V2 reference formats.
 */

import { supabase } from '../src/config/supabase';
import { creditsafeService } from '../src/services/creditsafeService';
import { decrypt } from '../src/services/encryption';

interface FailedCheck {
  reference_id: string;
  created_at: string;
}

interface VerificationInput {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  address: string;
  postcode: string;
}

function decryptFormData(formData: any): any {
  if (!formData) return null;

  const decrypted: any = {};
  for (const [key, value] of Object.entries(formData)) {
    if (typeof value === 'string' && value.includes(':')) {
      // Might be encrypted
      try {
        const decryptedValue = decrypt(value);
        decrypted[key] = decryptedValue || value;
      } catch {
        decrypted[key] = value;
      }
    } else if (typeof value === 'object' && value !== null) {
      decrypted[key] = decryptFormData(value);
    } else {
      decrypted[key] = value;
    }
  }
  return decrypted;
}

async function getVerificationData(reference: any): Promise<VerificationInput | null> {
  // Try V2 format first (form_data)
  if (reference.form_data) {
    const formData = decryptFormData(reference.form_data);
    const identity = formData?.identity;
    const residential = formData?.residential;

    if (identity?.firstName && identity?.lastName && identity?.dateOfBirth && residential?.currentAddress) {
      return {
        firstName: identity.firstName,
        lastName: identity.lastName,
        dateOfBirth: identity.dateOfBirth,
        address: `${residential.currentAddress.line1}, ${residential.currentAddress.city}`,
        postcode: residential.currentAddress.postcode
      };
    }
  }

  // Try V1 format (individual encrypted columns)
  const firstName = decrypt(reference.tenant_first_name_encrypted);
  const lastName = decrypt(reference.tenant_last_name_encrypted);
  const dateOfBirth = decrypt(reference.date_of_birth_encrypted);
  const address = decrypt(reference.current_address_line1_encrypted);
  const city = decrypt(reference.current_city_encrypted);
  const postcode = decrypt(reference.current_postcode_encrypted);

  if (firstName && lastName && dateOfBirth && (address || city) && postcode) {
    return {
      firstName,
      lastName,
      dateOfBirth,
      address: [address, city].filter(Boolean).join(', '),
      postcode
    };
  }

  return null;
}

async function rerunFailedCreditChecks() {
  console.log('='.repeat(60));
  console.log('Re-running failed credit checks');
  console.log('='.repeat(60));

  // Check if Creditsafe is working first
  console.log('\nTesting Creditsafe connection...');
  const testResult = await creditsafeService.verifyIndividual({
    firstName: 'Test',
    lastName: 'User',
    dateOfBirth: '1990-01-01',
    address: '10 Downing Street, London',
    postcode: 'SW1A 2AA'
  });

  if (testResult.status === 'error' && testResult.errorMessage?.includes('authentication')) {
    console.log('\n❌ Creditsafe authentication failed.');
    console.log('   Error:', testResult.errorMessage);
    process.exit(1);
  }

  console.log('✅ Creditsafe connection working\n');

  // Get failed credit checks
  const { data: failedChecks, error } = await supabase
    .from('creditsafe_verifications')
    .select('reference_id, created_at')
    .eq('verification_status', 'error')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching failed checks:', error);
    process.exit(1);
  }

  if (!failedChecks || failedChecks.length === 0) {
    console.log('No failed credit checks found to re-run.');
    process.exit(0);
  }

  console.log(`Found ${failedChecks.length} failed credit checks to re-run.\n`);

  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (const check of failedChecks as FailedCheck[]) {
    const refId = check.reference_id;
    console.log(`\nProcessing reference: ${refId}`);

    try {
      // Get reference data
      const { data: reference } = await supabase
        .from('tenant_references')
        .select('*')
        .eq('id', refId)
        .single();

      if (!reference) {
        console.log('  ⚠️  Reference not found, skipping');
        skipped++;
        continue;
      }

      // Extract required fields (handles both V1 and V2)
      const verificationData = await getVerificationData(reference);

      if (!verificationData) {
        console.log('  ⚠️  Missing required data (name/DOB/address), skipping');
        skipped++;
        continue;
      }

      const { firstName, lastName, dateOfBirth, address, postcode } = verificationData;

      // Run credit check
      console.log(`  Running credit check for ${firstName} ${lastName}...`);
      const result = await creditsafeService.verifyIndividual({
        firstName,
        lastName,
        dateOfBirth,
        address,
        postcode
      });

      // Store result
      await creditsafeService.storeVerificationResult(
        refId,
        { firstName, lastName, dateOfBirth, address, postcode },
        result
      );

      if (result.status === 'error') {
        console.log(`  ❌ Failed: ${result.errorMessage}`);
        failed++;
      } else {
        console.log(`  ✅ ${result.status} (risk: ${result.riskLevel || 'N/A'}, score: ${result.riskScore || 'N/A'})`);
        success++;
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (err: any) {
      console.log(`  ❌ Error: ${err.message}`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('Summary:');
  console.log(`  ✅ Success: ${success}`);
  console.log(`  ❌ Failed:  ${failed}`);
  console.log(`  ⚠️  Skipped: ${skipped}`);
  console.log('='.repeat(60));
}

rerunFailedCreditChecks().catch(console.error);
