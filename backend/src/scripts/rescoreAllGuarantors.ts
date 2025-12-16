// Batch script to rescore all guarantor references after rent_share fix
import { supabase } from '../config/supabase';
import { assessApplicationScore } from '../services/application-assesment/assessApplication';
import { generatePassedPdfService } from '../services/generatePassedPdfService';

async function main() {
  console.log('Finding all guarantor references with rent_share...');

  // Find all guarantor references that have rent_share set
  const { data: guarantors, error } = await supabase
    .from('tenant_references')
    .select('id, tenant_first_name_encrypted, status, passed_certificate_url, rent_share, monthly_rent')
    .eq('is_guarantor', true)
    .not('rent_share', 'is', null);

  if (error) {
    console.error('Error fetching guarantors:', error);
    process.exit(1);
  }

  if (!guarantors || guarantors.length === 0) {
    console.log('No guarantor references found with rent_share');
    process.exit(0);
  }

  console.log(`Found ${guarantors.length} guarantor references to rescore`);

  let rescored = 0;
  let pdfsRegenerated = 0;
  let errors = 0;

  for (const guarantor of guarantors) {
    try {
      console.log(`\nRescoring guarantor ${guarantor.id} (rent_share: ${guarantor.rent_share}, monthly_rent: ${guarantor.monthly_rent})...`);

      // Rescore the reference
      await assessApplicationScore(guarantor.id, 'System');
      rescored++;
      console.log(`  ✓ Rescored`);

      // If they have a passed certificate, regenerate the PDF
      if (guarantor.status === 'completed' && guarantor.passed_certificate_url) {
        try {
          const pdfUrl = await generatePassedPdfService(guarantor.id);
          pdfsRegenerated++;
          console.log(`  ✓ PDF regenerated: ${pdfUrl}`);
        } catch (pdfError) {
          console.error(`  ✗ PDF regeneration failed:`, pdfError);
        }
      }
    } catch (err) {
      console.error(`  ✗ Error rescoring ${guarantor.id}:`, err);
      errors++;
    }
  }

  console.log('\n========== Summary ==========');
  console.log(`Total guarantors found: ${guarantors.length}`);
  console.log(`Successfully rescored: ${rescored}`);
  console.log(`PDFs regenerated: ${pdfsRegenerated}`);
  console.log(`Errors: ${errors}`);

  process.exit(errors > 0 ? 1 : 0);
}

main();
