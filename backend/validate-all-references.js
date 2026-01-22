const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL || 'https://spaetpdmlqfygsxiawul.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY ? Buffer.from(process.env.ENCRYPTION_KEY, 'base64') : null;

function decrypt(encryptedText) {
  if (!encryptedText || !ENCRYPTION_KEY) return null;
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
  console.log('🔍 COMPREHENSIVE REFERENCE STATUS VALIDATION\n');
  console.log('='.repeat(80));
  console.log('');

  // Get all non-archived references
  const { data: references, error } = await supabase
    .from('tenant_references')
    .select('*')
    .neq('status', 'archived')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error fetching references:', error);
    return;
  }

  console.log(`📊 Found ${references.length} active references\n`);
  console.log('='.repeat(80));
  console.log('');

  const issues = [];
  const fixes = [];

  for (const ref of references) {
    const refId = ref.id.substring(0, 8);
    const hasSubmitted = !!ref.submitted_at;

    // Check if form data exists
    const dob = decrypt(ref.date_of_birth_encrypted) || ref.date_of_birth;
    const contact = decrypt(ref.contact_number_encrypted) || ref.contact_number;
    const empStatus = decrypt(ref.employment_status_encrypted) || ref.employment_status;
    const resStatus = decrypt(ref.residential_status_encrypted) || ref.residential_status;
    const hasFormData = !!(dob || contact || empStatus || resStatus);

    // Check evidence flags
    const hasIdProof = ref.has_id_proof || false;
    const hasAddressProof = ref.has_address_proof || false;
    const hasFinancialProof = ref.has_financial_proof || false;
    const hasAnyEvidence = hasIdProof || hasAddressProof || hasFinancialProof;

    // RULE 1: Status should be 'pending' if not submitted, 'in_progress' if submitted
    if (!hasSubmitted && ref.status === 'in_progress') {
      issues.push({
        id: ref.id,
        shortId: refId,
        issue: `Status is 'in_progress' but NOT submitted`,
        currentStatus: ref.status,
        currentVerificationState: ref.verification_state,
        expectedStatus: 'pending',
        expectedVerificationState: null,
        hasFormData,
        hasSubmitted: false
      });
    }

    // RULE 2: verification_state should be NULL if not submitted
    if (!hasSubmitted && ref.verification_state) {
      issues.push({
        id: ref.id,
        shortId: refId,
        issue: `verification_state is '${ref.verification_state}' but NOT submitted`,
        currentStatus: ref.status,
        currentVerificationState: ref.verification_state,
        expectedStatus: ref.status,
        expectedVerificationState: null,
        hasFormData,
        hasSubmitted: false
      });
    }

    // RULE 3: If submitted but no evidence, should be COLLECTING_EVIDENCE
    if (hasSubmitted && !hasAnyEvidence && ref.verification_state !== 'COLLECTING_EVIDENCE') {
      issues.push({
        id: ref.id,
        shortId: refId,
        issue: `Submitted but no evidence - should be COLLECTING_EVIDENCE`,
        currentStatus: ref.status,
        currentVerificationState: ref.verification_state,
        expectedStatus: ref.status,
        expectedVerificationState: 'COLLECTING_EVIDENCE',
        hasFormData,
        hasSubmitted: true,
        hasEvidence: false
      });
    }

    // RULE 4: If evidence uploaded or form data present, should be READY_FOR_REVIEW
    if (hasSubmitted && (hasAnyEvidence || hasFormData) &&
        ref.verification_state !== 'READY_FOR_REVIEW' &&
        ref.verification_state !== 'COMPLETED' &&
        ref.verification_state !== 'REJECTED' &&
        ref.verification_state !== 'WAITING_ON_REFERENCES') {
      issues.push({
        id: ref.id,
        shortId: refId,
        issue: `Has evidence/form data - should be READY_FOR_REVIEW`,
        currentStatus: ref.status,
        currentVerificationState: ref.verification_state,
        expectedStatus: ref.status,
        expectedVerificationState: 'READY_FOR_REVIEW',
        hasFormData,
        hasSubmitted: true,
        hasEvidence: hasAnyEvidence
      });
    }
  }

  console.log('📋 VALIDATION RESULTS:\n');

  if (issues.length === 0) {
    console.log('✅ ALL REFERENCES ARE VALID - No issues found!\n');
  } else {
    console.log(`❌ Found ${issues.length} reference(s) with issues:\n`);

    issues.forEach((issue, index) => {
      console.log(`\n${index + 1}. Reference: ${issue.shortId}...`);
      console.log(`   Issue: ${issue.issue}`);
      console.log(`   Current Status: ${issue.currentStatus}`);
      console.log(`   Current Verification State: ${issue.currentVerificationState || 'NULL'}`);
      console.log(`   Expected Status: ${issue.expectedStatus}`);
      console.log(`   Expected Verification State: ${issue.expectedVerificationState || 'NULL'}`);
      console.log(`   Has Form Data: ${issue.hasFormData ? 'Yes' : 'No'}`);
      console.log(`   Has Submitted: ${issue.hasSubmitted ? 'Yes' : 'No'}`);
      if (issue.hasEvidence !== undefined) {
        console.log(`   Has Evidence: ${issue.hasEvidence ? 'Yes' : 'No'}`);
      }

      // Prepare fix
      const fix = { id: issue.id };
      if (issue.currentStatus !== issue.expectedStatus) {
        fix.status = issue.expectedStatus;
      }
      if (issue.currentVerificationState !== issue.expectedVerificationState) {
        fix.verification_state = issue.expectedVerificationState;
      }
      fixes.push(fix);
    });

    console.log('\n');
    console.log('='.repeat(80));
    console.log('\n🔧 PROPOSED FIXES:\n');

    fixes.forEach((fix, index) => {
      const issue = issues[index];
      console.log(`${index + 1}. Reference: ${issue.shortId}...`);
      if (fix.status) {
        console.log(`   - Set status: ${issue.currentStatus} → ${fix.status}`);
      }
      if (fix.verification_state !== undefined) {
        console.log(`   - Set verification_state: ${issue.currentVerificationState || 'NULL'} → ${fix.verification_state || 'NULL'}`);
      }
    });

    console.log('\n');
    console.log('='.repeat(80));
    console.log('\n💾 To apply fixes, run: node apply-reference-fixes.js\n');

    // Save fixes to file
    const fs = require('fs');
    fs.writeFileSync(
      path.join(__dirname, 'reference-fixes.json'),
      JSON.stringify(fixes, null, 2)
    );
    console.log('✅ Fixes saved to reference-fixes.json\n');
  }

  console.log('='.repeat(80));
  console.log('');
})();
