/**
 * Script to regenerate a single PDF report for a specific reference
 * Run with: npx ts-node src/scripts/regenerateSingleReport.ts <referenceId>
 */

import { supabase } from '../config/supabase';
import { generatePassedPdfService } from '../services/generatePassedPdfService';
import { decrypt } from '../services/encryption';

async function regenerateSingleReport(referenceId: string) {
  console.log(`\nRegenerating PDF report for reference: ${referenceId}\n`);

  // Fetch the reference
  const { data: ref, error } = await supabase
    .from('tenant_references')
    .select('id, tenant_first_name_encrypted, tenant_last_name_encrypted, status, passed_certificate_url')
    .eq('id', referenceId)
    .single();

  if (error) {
    console.error('Error fetching reference:', error.message);
    process.exit(1);
  }

  if (!ref) {
    console.error('Reference not found');
    process.exit(1);
  }

  const firstName = decrypt(ref.tenant_first_name_encrypted) || 'Unknown';
  const lastName = decrypt(ref.tenant_last_name_encrypted) || '';

  console.log(`Reference: ${firstName} ${lastName}`);
  console.log(`Status: ${ref.status}`);
  console.log(`Current PDF URL: ${ref.passed_certificate_url || 'None'}\n`);

  try {
    console.log('Generating new PDF...');

    // generatePassedPdfService handles upload and returns URL
    const pdfUrl = await generatePassedPdfService(ref.id);

    // Update the database with the new PDF URL
    const { error: updateError } = await supabase
      .from('tenant_references')
      .update({ passed_certificate_url: pdfUrl })
      .eq('id', ref.id);

    if (updateError) {
      console.error(`PDF generated but failed to update DB: ${updateError.message}`);
      process.exit(1);
    }

    console.log(`\n✅ Successfully regenerated PDF report!`);
    console.log(`New URL: ${pdfUrl}\n`);
  } catch (err: any) {
    console.error(`\n❌ Failed to generate PDF: ${err.message}\n`);
    process.exit(1);
  }

  process.exit(0);
}

// Get reference ID from command line argument
const referenceId = process.argv[2];

if (!referenceId) {
  console.error('Usage: npx ts-node src/scripts/regenerateSingleReport.ts <referenceId>');
  process.exit(1);
}

regenerateSingleReport(referenceId);
