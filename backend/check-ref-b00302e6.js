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
  const refId = 'b00302e6-dc23-4637-99c5-4c5e3f38d0cc';

  console.log(`🔍 Checking reference ${refId}\n`);
  console.log('='.repeat(80));
  console.log('');

  // Get reference details
  const { data: reference, error: refError } = await supabase
    .from('tenant_references')
    .select('*')
    .eq('id', refId)
    .single();

  if (refError || !reference) {
    console.error('❌ Reference not found:', refError?.message || 'No data');
    return;
  }

  console.log('📋 REFERENCE DETAILS:\n');
  console.log(`Status: ${reference.status}`);
  console.log(`Verification State: ${reference.verification_state || 'N/A'}`);
  console.log(`Is Guarantor: ${reference.is_guarantor}`);
  console.log(`Created: ${reference.created_at}`);
  console.log(`Submitted At: ${reference.submitted_at || 'NOT SUBMITTED'}`);
  console.log('');

  // Decrypt and show tenant info
  const tenantName = `${decrypt(reference.tenant_first_name_encrypted) || reference.tenant_first_name || ''} ${decrypt(reference.tenant_last_name_encrypted) || reference.tenant_last_name || ''}`.trim();
  const tenantEmail = decrypt(reference.tenant_email_encrypted) || reference.tenant_email;
  const tenantPhone = decrypt(reference.tenant_phone_encrypted) || reference.tenant_phone;
  const propertyAddress = decrypt(reference.property_address_encrypted) || reference.property_address;

  console.log('👤 TENANT INFO:\n');
  console.log(`Name: ${tenantName || 'N/A'}`);
  console.log(`Email: ${tenantEmail || 'N/A'}`);
  console.log(`Phone: ${tenantPhone || 'N/A'}`);
  console.log(`Property: ${propertyAddress || 'N/A'}`);
  console.log('');

  // Check if tenant form data is filled
  console.log('📝 TENANT FORM DATA:\n');

  const checkField = (label, encrypted, plain) => {
    const value = decrypt(encrypted) || plain;
    console.log(`${label}: ${value || '❌ MISSING'}`);
  };

  checkField('Date of Birth', reference.date_of_birth_encrypted, reference.date_of_birth);
  checkField('Contact Number', reference.contact_number_encrypted, reference.contact_number);
  checkField('Employment Status', reference.employment_status_encrypted, reference.employment_status);
  checkField('Residential Status', reference.residential_status_encrypted, reference.residential_status);
  console.log('');

  // Check employment details
  if (reference.employment_status === 'employed' || decrypt(reference.employment_status_encrypted) === 'employed') {
    console.log('💼 EMPLOYMENT DETAILS:\n');
    checkField('Employer Name', reference.employment_employer_name_encrypted, reference.employment_employer_name);
    checkField('Job Title', reference.employment_job_title_encrypted, reference.employment_job_title);
    checkField('Employment Start Date', reference.employment_start_date_encrypted, reference.employment_start_date);
    checkField('Salary', reference.employment_salary_amount_encrypted, reference.employment_salary_amount);
    checkField('Employer Ref Email', reference.employer_ref_email_encrypted, reference.employer_ref_email);
    console.log('');
  }

  // Check if evidence files exist
  console.log('📎 EVIDENCE FILES:\n');

  const { data: files, error: filesError } = await supabase
    .from('evidence_files')
    .select('*')
    .eq('reference_id', refId);

  if (filesError) {
    console.error('Error fetching files:', filesError);
  } else if (files && files.length > 0) {
    files.forEach((file, i) => {
      console.log(`${i + 1}. ${file.file_type}: ${file.file_name}`);
      console.log(`   Uploaded: ${file.created_at}`);
      console.log(`   Size: ${(file.file_size / 1024).toFixed(2)} KB`);
    });
  } else {
    console.log('❌ No evidence files uploaded');
  }
  console.log('');

  // Check verification sections
  console.log('✅ VERIFICATION SECTIONS:\n');

  const { data: sections, error: sectionsError } = await supabase
    .from('verification_sections')
    .select('*')
    .eq('reference_id', refId)
    .order('section_order', { ascending: true });

  if (sectionsError) {
    console.error('Error fetching sections:', sectionsError);
  } else if (sections && sections.length > 0) {
    sections.forEach((section, i) => {
      console.log(`${i + 1}. ${section.section_type}`);
      console.log(`   Decision: ${section.decision}`);
      console.log(`   Verified: ${section.is_verified ? 'YES' : 'NO'}`);
    });
  } else {
    console.log('❌ No verification sections created');
  }
  console.log('');

  // Check reference notes
  const { data: notes, error: notesError } = await supabase
    .from('reference_notes')
    .select('*')
    .eq('reference_id', refId)
    .order('created_at', { ascending: false })
    .limit(5);

  if (notes && notes.length > 0) {
    console.log('📝 RECENT NOTES:\n');
    notes.forEach((note, i) => {
      const noteText = decrypt(note.note_encrypted) || note.note || '';
      console.log(`${i + 1}. ${noteText.substring(0, 100)}${noteText.length > 100 ? '...' : ''}`);
      console.log(`   ${note.created_at}`);
    });
    console.log('');
  }

  // Diagnose the issue
  console.log('='.repeat(80));
  console.log('\n🔍 DIAGNOSIS:\n');

  if (!reference.submitted_at) {
    console.log('❌ ISSUE: Reference has NOT been submitted by the tenant');
    console.log('   The tenant needs to complete and submit their form');
  } else {
    console.log('✅ Reference was submitted at:', reference.submitted_at);
  }

  if (!files || files.length === 0) {
    console.log('⚠️  No evidence files uploaded');
  }

  if (!sections || sections.length === 0) {
    console.log('⚠️  No verification sections created');
    console.log('   This might be normal if the reference is still being collected');
  }

  const hasFormData = (
    reference.date_of_birth || reference.date_of_birth_encrypted ||
    reference.contact_number || reference.contact_number_encrypted ||
    reference.employment_status || reference.employment_status_encrypted
  );

  if (!hasFormData) {
    console.log('❌ ISSUE: No tenant form data found');
    console.log('   The tenant form may not have been saved properly');
  }

  console.log('');
})();
