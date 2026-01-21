const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://spaetpdmlqfygsxiawul.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');

function decrypt(encryptedText) {
  if (!encryptedText) return null;
  try {
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedData = Buffer.from(parts[1], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedData);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (err) {
    return null;
  }
}

const supabase = createClient(supabaseUrl, supabaseKey);

(async () => {
  console.log('🔍 CHECKING EVIDENCE FILE PATHS\n');
  console.log('='.repeat(80));
  console.log('');

  // Get references in READY_FOR_REVIEW state
  const { data: references, error: refError } = await supabase
    .from('tenant_references')
    .select(`
      id,
      tenant_first_name_encrypted,
      tenant_last_name_encrypted,
      selfie_path,
      id_document_path,
      payslip_files,
      bank_statements_paths,
      tax_return_path,
      tenancy_agreement_path,
      rtr_british_passport_path,
      rtr_british_alt_doc_path
    `)
    .eq('verification_state', 'READY_FOR_REVIEW')
    .limit(10);

  if (refError) {
    console.error('Error fetching references:', refError);
    return;
  }

  console.log(`Found ${references.length} references in READY_FOR_REVIEW\n`);

  for (const ref of references) {
    const tenantName = `${decrypt(ref.tenant_first_name_encrypted) || ''} ${decrypt(ref.tenant_last_name_encrypted) || ''}`.trim();
    console.log(`Reference: ${tenantName} (${ref.id})`);

    // Collect all file paths
    const files = [];
    if (ref.selfie_path) files.push({ type: 'Selfie', path: ref.selfie_path });
    if (ref.id_document_path) files.push({ type: 'ID Document', path: ref.id_document_path });
    if (ref.rtr_british_passport_path) files.push({ type: 'Passport', path: ref.rtr_british_passport_path });
    if (ref.rtr_british_alt_doc_path) files.push({ type: 'RTR Alt Doc', path: ref.rtr_british_alt_doc_path });
    if (ref.tax_return_path) files.push({ type: 'Tax Return', path: ref.tax_return_path });
    if (ref.tenancy_agreement_path) files.push({ type: 'Tenancy Agreement', path: ref.tenancy_agreement_path });

    if (Array.isArray(ref.payslip_files)) {
      ref.payslip_files.forEach((path, i) => files.push({ type: `Payslip ${i + 1}`, path }));
    }

    if (Array.isArray(ref.bank_statements_paths)) {
      ref.bank_statements_paths.forEach((path, i) => files.push({ type: `Bank Statement ${i + 1}`, path }));
    }

    if (files.length === 0) {
      console.log('  ⚠️  No files found');
    }

    // Check each file
    for (const file of files) {
      // Check path format (should be referenceId/folder/filename)
      const parts = file.path.split('/');
      if (parts.length !== 3) {
        console.log(`  ❌ ${file.type}: Invalid path format - ${file.path}`);
        continue;
      }

      const [refId, folder, filename] = parts;

      // Verify file exists in storage
      const { data, error } = await supabase.storage
        .from('tenant-documents')
        .download(file.path);

      if (error) {
        console.log(`  ❌ ${file.type}: File not found in storage - ${file.path}`);
        console.log(`     Error: ${error.message}`);
      } else {
        console.log(`  ✅ ${file.type}: ${filename} (${(await data.arrayBuffer()).byteLength} bytes)`);
      }
    }

    console.log('');
  }

  console.log('='.repeat(80));
})();
