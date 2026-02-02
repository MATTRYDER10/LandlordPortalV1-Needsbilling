import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { decrypt } from '../services/encryption';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function findMissingSections() {
  console.log('=== FINDING MISSING EXTERNAL REFERENCE SECTIONS ===\n');

  // Get all active submitted references
  const { data: refs } = await supabase
    .from('tenant_references')
    .select('*')
    .not('verification_state', 'in', '(COMPLETED,REJECTED,CANCELLED)')
    .not('submitted_at', 'is', null)
    .order('created_at', { ascending: false });

  console.log(`Found ${refs?.length || 0} active submitted references\n`);

  if (!refs || refs.length === 0) {
    console.log('No active submitted references');
    return;
  }

  let issuesFound = 0;

  for (const ref of refs) {
    const firstName = decrypt(ref.tenant_first_name_encrypted);
    const lastName = decrypt(ref.tenant_last_name_encrypted);

    // Get employment history
    const { data: employment } = await supabase
      .from('employment_history')
      .select('*')
      .eq('tenant_reference_id', ref.id);

    // Get residential history
    const { data: residential } = await supabase
      .from('residential_history')
      .select('*')
      .eq('tenant_reference_id', ref.id);

    // Get verification sections
    const { data: sections } = await supabase
      .from('verification_sections')
      .select('section_type')
      .eq('reference_id', ref.id);

    const sectionTypes = sections?.map(s => s.section_type) || [];

    // Check if employment history exists but no EMPLOYER_REFERENCE section
    const needsEmployerRef = employment && employment.length > 0;
    const hasEmployerRefSection = sectionTypes.includes('EMPLOYER_REFERENCE');

    // Check if residential history exists but no LANDLORD_REFERENCE section
    const needsLandlordRef = residential && residential.length > 0;
    const hasLandlordRefSection = sectionTypes.includes('LANDLORD_REFERENCE');

    // Check if self-employed (would need ACCOUNTANT_REFERENCE)
    const isSelfEmployed = employment?.some((e: any) =>
      e.employment_status === 'self_employed' ||
      e.employment_type === 'self_employed'
    );
    const hasAccountantRefSection = sectionTypes.includes('ACCOUNTANT_REFERENCE');

    let hasIssue = false;
    const issues: string[] = [];

    if (needsEmployerRef && !hasEmployerRefSection) {
      issues.push(`MISSING EMPLOYER_REFERENCE (has ${employment!.length} employment records)`);
      hasIssue = true;
    }

    if (needsLandlordRef && !hasLandlordRefSection) {
      issues.push(`MISSING LANDLORD_REFERENCE (has ${residential!.length} residential records)`);
      hasIssue = true;
    }

    if (isSelfEmployed && !hasAccountantRefSection) {
      issues.push(`MISSING ACCOUNTANT_REFERENCE (self-employed)`);
      hasIssue = true;
    }

    if (hasIssue) {
      issuesFound++;
      console.log(`\n${issuesFound}. ${firstName} ${lastName}`);
      console.log(`   Reference ID: ${ref.id}`);
      console.log(`   Created: ${new Date(ref.created_at).toLocaleString()}`);
      console.log(`   Submitted: ${new Date(ref.submitted_at).toLocaleString()}`);
      console.log(`   State: ${ref.verification_state || 'null'}`);
      console.log(`   Status: ${ref.status}`);
      console.log(`   Issues:`);
      issues.forEach(issue => console.log(`     - ${issue}`));

      console.log(`   Existing sections: ${sectionTypes.length > 0 ? sectionTypes.join(', ') : 'NONE'}`);
      console.log(`   Employment records: ${employment?.length || 0}`);
      console.log(`   Residential records: ${residential?.length || 0}`);
    }
  }

  if (issuesFound === 0) {
    console.log('\n✅ NO MISSING SECTIONS - All references have correct sections!\n');
  } else {
    console.log(`\n\n⚠️  FOUND ${issuesFound} REFERENCES WITH MISSING EXTERNAL SECTIONS\n`);
    console.log('These sections need to be created and initial requests sent!');
  }

  console.log('\n=== END CHECK ===');
}

findMissingSections();
