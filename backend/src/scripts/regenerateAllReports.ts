/**
 * Script to regenerate ALL PDF reports for completed references using the correct template
 * Run with: npx ts-node src/scripts/regenerateAllReports.ts
 */

import { supabase } from '../config/supabase';
import { generatePassedPdfService } from '../services/generatePassedPdfService';
import { decrypt } from '../services/encryption';

async function regenerateAllReports() {
  console.log('Finding ALL completed references...\n');

  // Find ALL completed references
  const { data: references, error } = await supabase
    .from('tenant_references')
    .select('id, tenant_first_name_encrypted, tenant_last_name_encrypted, status, passed_certificate_url, updated_at')
    .eq('status', 'completed')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error fetching references:', error);
    process.exit(1);
  }

  if (!references || references.length === 0) {
    console.log('No completed references found.');
    process.exit(0);
  }

  console.log(`Found ${references.length} completed references:\n`);

  for (const ref of references) {
    const firstName = decrypt(ref.tenant_first_name_encrypted) || 'Unknown';
    const lastName = decrypt(ref.tenant_last_name_encrypted) || '';
    console.log(`  - ${firstName} ${lastName} (${ref.id})`);
  }

  console.log('\nRegenerating PDF reports...\n');

  let successCount = 0;
  let failCount = 0;

  for (const ref of references) {
    const firstName = decrypt(ref.tenant_first_name_encrypted) || 'Unknown';
    const lastName = decrypt(ref.tenant_last_name_encrypted) || '';

    try {
      console.log(`Generating PDF for ${firstName} ${lastName}...`);

      // generatePassedPdfService handles upload and returns URL
      const pdfUrl = await generatePassedPdfService(ref.id);

      // Update the database with the new PDF URL
      const { error: updateError } = await supabase
        .from('tenant_references')
        .update({ passed_certificate_url: pdfUrl })
        .eq('id', ref.id);

      if (updateError) {
        console.error(`  ⚠️ PDF generated but failed to update DB: ${updateError.message}`);
      }

      console.log(`  ✅ Generated and saved: ${pdfUrl}\n`);
      successCount++;
    } catch (err: any) {
      console.error(`  ❌ Failed for ${firstName} ${lastName}: ${err.message}\n`);
      failCount++;
    }
  }

  console.log('\n========================================');
  console.log(`Results: ${successCount} succeeded, ${failCount} failed`);
  console.log('========================================\n');

  process.exit(failCount > 0 ? 1 : 0);
}

regenerateAllReports();
