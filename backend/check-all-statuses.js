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
  console.log('🔍 COMPREHENSIVE STATUS CHECK\n');
  console.log('='.repeat(80));
  console.log('');

  // Get all non-pending references (submitted references)
  const { data: references, error: refError } = await supabase
    .from('tenant_references')
    .select(`
      id,
      status,
      verification_state,
      submitted_at,
      tenant_first_name_encrypted,
      tenant_last_name_encrypted,
      property_address_encrypted,
      is_guarantor,
      requires_guarantor,
      income_student,
      income_unemployed,
      income_regular_employment,
      income_self_employed,
      confirmed_residential_status,
      reference_type,
      selfie_path,
      id_document_path,
      is_british_citizen,
      rtr_share_code,
      rtr_british_passport_path,
      rtr_british_no_passport,
      rtr_british_alt_doc_path,
      payslip_files,
      bank_statements_paths,
      tax_return_path,
      other_proof_of_funds_path,
      tenancy_agreement_path,
      employer_references (id, submitted_at, signature_encrypted, annual_salary_encrypted),
      landlord_references (id, submitted_at),
      agent_references (id, submitted_at),
      accountant_references (id, submitted_at, signature_encrypted),
      company:companies(name_encrypted)
    `)
    .neq('status', 'pending')
    .order('submitted_at', { ascending: false })
    .limit(50);

  if (refError) {
    console.error('Error fetching references:', refError);
    return;
  }

  console.log(`Found ${references.length} submitted references\n`);

  let checkCount = 0;
  let issueCount = 0;
  const issues = [];

  for (const ref of references) {
    checkCount++;
    const tenantName = `${decrypt(ref.tenant_first_name_encrypted) || ''} ${decrypt(ref.tenant_last_name_encrypted) || ''}`.trim();
    const propertyAddress = decrypt(ref.property_address_encrypted) || 'N/A';
    const companyName = decrypt(ref.company?.name_encrypted) || 'N/A';

    // Check evidence completeness
    const hasIdentity = ref.selfie_path && ref.id_document_path;

    const hasRTR = ref.is_guarantor ||
      (ref.is_british_citizen === true && (ref.rtr_british_passport_path || (ref.rtr_british_no_passport && ref.rtr_british_alt_doc_path))) ||
      (ref.is_british_citizen === false && ref.rtr_share_code);

    const isStudentWithGuarantor = ref.income_student && ref.requires_guarantor;
    const isUnemployedLivingWithFamily = ref.income_unemployed &&
      (ref.confirmed_residential_status === 'Living with Family' || ref.reference_type === 'living_with_family');

    const hasIncomeEvidence =
      isStudentWithGuarantor ||
      isUnemployedLivingWithFamily ||
      ref.employer_references?.some(er => er.submitted_at && (er.signature_encrypted || er.annual_salary_encrypted)) ||
      (Array.isArray(ref.payslip_files) && ref.payslip_files.length > 0) ||
      (Array.isArray(ref.bank_statements_paths) && ref.bank_statements_paths.length > 0) ||
      ref.accountant_references?.some(ar => ar.submitted_at && ar.signature_encrypted) ||
      ref.tax_return_path ||
      ref.other_proof_of_funds_path;

    const hasResidential = ref.is_guarantor ||
      ref.confirmed_residential_status ||
      ref.reference_type === 'living_with_family' ||
      ref.landlord_references?.some(lr => lr.submitted_at) ||
      ref.agent_references?.some(ar => ar.submitted_at) ||
      ref.tenancy_agreement_path;

    const evidenceComplete = hasIdentity && hasRTR && hasIncomeEvidence && hasResidential;

    // Check chase dependencies
    const { data: chaseDeps } = await supabase
      .from('chase_dependencies')
      .select('id, dependency_type, status')
      .eq('reference_id', ref.id);

    const pendingChases = chaseDeps?.filter(d => d.status === 'CHASING') || [];
    const hasPendingExternalDeps = pendingChases.length > 0;

    // Determine expected state
    let expectedState = null;
    if (!evidenceComplete && !hasPendingExternalDeps) {
      expectedState = 'COLLECTING_EVIDENCE';
    } else if (!evidenceComplete && hasPendingExternalDeps) {
      expectedState = 'WAITING_ON_REFERENCES';
    } else if (evidenceComplete) {
      expectedState = 'READY_FOR_REVIEW'; // Even if external refs pending, should be ready for review
    }

    // Check for mismatches
    const stateMismatch = expectedState && ref.verification_state !== expectedState;

    if (stateMismatch || (!hasIdentity && ref.verification_state === 'READY_FOR_REVIEW')) {
      issueCount++;
      issues.push({
        id: ref.id,
        tenantName,
        propertyAddress,
        companyName,
        currentState: ref.verification_state,
        expectedState,
        hasIdentity,
        hasRTR,
        hasIncomeEvidence,
        hasResidential,
        evidenceComplete,
        pendingChases: pendingChases.map(d => d.dependency_type).join(', ') || 'None'
      });

      console.log(`\n❌ ISSUE #${issueCount}`);
      console.log(`   Tenant: ${tenantName}`);
      console.log(`   Property: ${propertyAddress}`);
      console.log(`   Company: ${companyName}`);
      console.log(`   Reference ID: ${ref.id}`);
      console.log(`   Current State: ${ref.verification_state}`);
      console.log(`   Expected State: ${expectedState}`);
      console.log(`   Evidence Status:`);
      console.log(`     - Identity (selfie + ID): ${hasIdentity ? '✅' : '❌'}`);
      console.log(`     - Right to Rent: ${hasRTR ? '✅' : '❌'}`);
      console.log(`     - Income Evidence: ${hasIncomeEvidence ? '✅' : '❌'}`);
      console.log(`     - Residential: ${hasResidential ? '✅' : '❌'}`);
      console.log(`   Pending Chases: ${pendingChases.map(d => d.dependency_type).join(', ') || 'None'}`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log(`\n📊 SUMMARY\n`);
  console.log(`Total references checked: ${checkCount}`);
  console.log(`Issues found: ${issueCount}`);
  console.log(`Correctly synced: ${checkCount - issueCount}`);

  if (issues.length > 0) {
    console.log(`\n⚠️  STATE MISMATCHES DETECTED\n`);
    console.log(`These references need their verification_state updated:\n`);
    issues.forEach((issue, i) => {
      console.log(`${i + 1}. ${issue.tenantName} - ${issue.propertyAddress}`);
      console.log(`   Current: ${issue.currentState} → Expected: ${issue.expectedState}`);
      console.log(`   Reference ID: ${issue.id}`);
      console.log(``);
    });
  } else {
    console.log(`\n✅ All reference states are correctly synced with evidence!\n`);
  }
})();
